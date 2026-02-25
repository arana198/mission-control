"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface Business {
  _id: string;
  name: string;
  slug: string;
  color?: string;
  emoji?: string;
  description?: string;
  missionStatement?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

interface BusinessContextType {
  currentBusiness: Business | null;
  businesses: Business[];
  setCurrentBusiness: (business: Business) => void;
  isLoading: boolean;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const [currentBusiness, setCurrentBusinessState] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Query all businesses with fallback to empty array
  const businesses = useQuery(api.businesses.getAll);
  const defaultBusiness = useQuery(api.businesses.getDefault);

  // Provide default empty arrays if queries are still loading
  const businessesData = businesses ?? [];
  const defaultBusinessData = defaultBusiness ?? null;

  // Determine current business from URL or fallback
  useEffect(() => {
    // If data is still loading (null), don't proceed
    if (businesses === undefined || defaultBusiness === undefined) {
      return;
    }

    // If we have no businesses data, set loading and return
    if (businessesData.length === 0) {
      setIsLoading(true);
      return;
    }

    let business: Business | null = null;

    // 1. Try to get businessSlug from URL params
    const businessSlug = params?.businessSlug as string;
    if (businessSlug) {
      business = businessesData.find((b) => b.slug === businessSlug) || null;
    }

    // 2. Fall back to localStorage
    if (!business) {
      const savedSlug = localStorage.getItem("mission-control:businessSlug");
      if (savedSlug) {
        business = businessesData.find((b) => b.slug === savedSlug) || null;
      }
    }

    // 3. Fall back to default business
    if (!business && defaultBusinessData) {
      business = defaultBusinessData;
    }

    // 4. Fall back to first business
    if (!business && businessesData.length > 0) {
      business = businessesData[0];
    }

    setCurrentBusinessState(business);
    setIsLoading(false);

    // Save to localStorage for persistence
    if (business) {
      localStorage.setItem("mission-control:businessSlug", business.slug);
    }
  }, [businesses, defaultBusiness, businessesData, defaultBusinessData, params?.businessSlug]);

  // Handle switching to a different business
  const setCurrentBusiness = (business: Business) => {
    setCurrentBusinessState(business);
    localStorage.setItem("mission-control:businessSlug", business.slug);

    // Determine current tab from URL
    const currentTab = (params?.tab as string) || "overview";

    // Navigate to new business with same tab
    router.push(`/${business.slug}/${currentTab}`);
  };

  return (
    <BusinessContext.Provider
      value={{
        currentBusiness,
        businesses: businessesData,
        setCurrentBusiness,
        isLoading,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error("useBusiness must be used within a BusinessProvider");
  }
  return context;
}
