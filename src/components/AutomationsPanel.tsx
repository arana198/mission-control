"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { AlertCircle, Zap, Clock, Trash2, Plus } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface AutomationsPanelProps {
  businessId: Id<"businesses">;
}

export function AutomationsPanel({ businessId }: AutomationsPanelProps) {
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    condition: "taskBlocked > Xmin" as const,
    threshold: 30,
    severity: "warning" as const,
    cooldownSeconds: 300,
  });

  // Fetch alert rules and decisions
  const alertRules = useQuery(api.alertRules.getByBusiness, { businessId });
  const recentDecisions = useQuery(api.decisions.getByBusiness, {
    businessId,
    limit: 20,
  });

  // Mutations
  const toggleRule = useMutation(api.alertRules.toggle);
  const deleteRule = useMutation(api.alertRules.delete_);
  const createRule = useMutation(api.alertRules.create);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRule({
        businessId,
        name: formData.name,
        description: `Auto-created rule: ${formData.condition}`,
        condition: formData.condition,
        threshold: formData.threshold,
        severity: formData.severity,
        cooldownSeconds: formData.cooldownSeconds,
        channels: ["in-app"],
      });
      setFormData({
        name: "",
        condition: "taskBlocked > Xmin",
        threshold: 30,
        severity: "warning",
        cooldownSeconds: 300,
      });
      setShowNewRuleForm(false);
    } catch (error) {
      console.error("Failed to create rule:", error);
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const conditionLabel = (condition: string) => {
    const labels: Record<string, string> = {
      "taskBlocked > Xmin": "Task Blocked Timeout",
      "queueDepth > threshold": "Queue Depth Alert",
      "taskDueDate < now": "Overdue Tasks",
      "throughput < threshold": "Low Throughput",
      agentCrash: "Agent Crash Detection",
      custom: "Custom Condition",
    };
    return labels[condition] || condition;
  };

  return (
    <div className="space-y-6">
      {/* Alert Rules Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Alert Rules
          </h3>
          <button
            onClick={() => setShowNewRuleForm(!showNewRuleForm)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-3 h-3" />
            Add Rule
          </button>
        </div>

        {/* New Rule Form */}
        {showNewRuleForm && (
          <form
            onSubmit={handleCreateRule}
            className="mb-6 p-4 border rounded-lg bg-muted/50 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">
                Rule Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Long Blocked Tasks Alert"
                className="w-full px-3 py-2 border rounded text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Condition
                </label>
                <select
                  value={formData.condition}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condition: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="taskBlocked > Xmin">Task Blocked Timeout</option>
                  <option value="queueDepth > threshold">Queue Depth</option>
                  <option value="taskDueDate < now">Overdue Tasks</option>
                  <option value="throughput < threshold">Low Throughput</option>
                  <option value="agentCrash">Agent Crash</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Threshold
                </label>
                <input
                  type="number"
                  value={formData.threshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      threshold: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Severity
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      severity: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Cooldown (seconds)
                </label>
                <input
                  type="number"
                  value={formData.cooldownSeconds}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cooldownSeconds: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
              >
                Create Rule
              </button>
              <button
                type="button"
                onClick={() => setShowNewRuleForm(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded text-sm hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Rules List */}
        {alertRules && alertRules.length > 0 ? (
          <div className="space-y-2">
            {alertRules.map((rule) => (
              <div
                key={rule._id}
                className="p-3 border rounded-lg flex items-start justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{rule.name}</h4>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${severityColor(
                        rule.severity
                      )}`}
                    >
                      {rule.severity}
                    </span>
                    {!rule.enabled && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {conditionLabel(rule.condition)}
                    {rule.threshold ? ` (threshold: ${rule.threshold})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Cooldown: {rule.cooldownSeconds}s
                  </p>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => toggleRule({ ruleId: rule._id })}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      rule.enabled
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button
                    onClick={() => deleteRule({ ruleId: rule._id })}
                    className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No alert rules configured
          </div>
        )}
      </div>

      {/* Recent Decisions Section */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Recent Decisions Log
        </h3>

        {recentDecisions && recentDecisions.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentDecisions.map((decision) => (
              <div
                key={decision._id}
                className="p-3 border rounded-lg text-sm hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-medium text-xs uppercase text-muted-foreground">
                    {decision.action}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      decision.result === "success"
                        ? "bg-green-100 text-green-800"
                        : decision.result === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {decision.result}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  {decision.reason}
                </p>
                {decision.resultMessage && (
                  <p className="text-xs text-muted-foreground">
                    {decision.resultMessage}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(decision.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No decisions yet
          </div>
        )}
      </div>
    </div>
  );
}
