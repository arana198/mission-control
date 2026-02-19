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

  // Query all businesses
  const businesses = useQuery(api.businesses.getAll) || [];
  const defaultBusiness = useQuery(api.businesses.getDefault);

  // Determine current business from URL or fallback
  useEffect(() => {
    if (!businesses || businesses.length === 0) {
      setIsLoading(true);
      return;
    }

    let business: Business | null = null;

    // 1. Try to get businessSlug from URL params
    const businessSlug = params?.businessSlug as string;
    if (businessSlug) {
      business = businesses.find((b) => b.slug === businessSlug) || null;
    }

    // 2. Fall back to localStorage
    if (!business) {
      const savedSlug = localStorage.getItem("mission-control:businessSlug");
      if (savedSlug) {
        business = businesses.find((b) => b.slug === savedSlug) || null;
      }
    }

    // 3. Fall back to default business
    if (!business && defaultBusiness) {
      business = defaultBusiness;
    }

    // 4. Fall back to first business
    if (!business && businesses.length > 0) {
      business = businesses[0];
    }

    setCurrentBusinessState(business);
    setIsLoading(false);

    // Save to localStorage for persistence
    if (business) {
      localStorage.setItem("mission-control:businessSlug", business.slug);
    }
  }, [businesses, defaultBusiness, params?.businessSlug]);

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
        businesses,
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
