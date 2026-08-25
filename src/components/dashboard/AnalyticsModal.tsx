"use client";

import { X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { AdvancedAnalyticsDashboard } from "./AdvancedAnalyticsDashboard";
import { cn } from "@/lib/utils";
import type { CsvDataset } from "@/lib/types";

interface AnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  csvDataset: CsvDataset | null;
}

export function AnalyticsModal({ open, onClose, csvDataset }: AnalyticsModalProps) {
  if (!csvDataset) return null;

  // Parse CSV data into format expected by AdvancedAnalyticsDashboard
  const data = (() => {
    const parsed = csvDataset.csvText.split("\n").filter(Boolean);
    if (parsed.length === 0) return [];
    
    const headers = parsed[0].split(",");
    const rows = parsed.slice(1).map((line) => {
      const values = line.split(",");
      const row: Record<string, string | number> = {};
      headers.forEach((header, i) => {
        const val = values[i]?.trim() || "";
        // Try to convert to number if possible
        const numVal = parseFloat(val);
        row[header.trim()] = isNaN(numVal) ? val : numVal;
      });
      return row;
    });
    
    return rows;
  })();

  const csvText = csvDataset.csvText;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center p-4",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div
          className={cn(
            "relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl transition-all duration-300",
            open ? "scale-100 opacity-100" : "scale-95 opacity-0"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Data Analytics Dashboard</h2>
              <p className="text-sm text-muted">
                Analyzing {csvDataset.filename} ({csvDataset.nrows} rows, {csvDataset.columns.length} columns)
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>

          {/* Content */}
          <div className="scroll-thin max-h-[calc(90vh-80px)] overflow-auto px-6 py-4">
            <AdvancedAnalyticsDashboard data={data} fileName={csvDataset.filename} csvText={csvText} />
          </div>
        </div>
      </div>
    </>
  );
}

export default AnalyticsModal;
