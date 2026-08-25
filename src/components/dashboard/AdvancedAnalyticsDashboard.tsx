"use client";

import { useState, useMemo } from "react";
import {
  ChartLine,
  Table,
  Funnel,
  Sliders,
  DownloadSimple,
  SortAscending,
  Calculator,
  TrendUp,
  ChartBar,
  Graph,
  X,
  Plus,
  Trash,
  MagnifyingGlass,
  Broom,
  Warning,
  CheckCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PlotlyChart } from "./PlotlyChart";
import { cn } from "@/lib/utils";
import type { PlotlyFigure } from "@/lib/types";
import { analyzeCsv, buildCleaningPlan, applyCleaning, type CleanStrategy, STRATEGY_LABEL, type CsvIssues } from "@/lib/dataCleaning";

interface DataPoint {
  [key: string]: string | number;
}

interface AdvancedAnalyticsDashboardProps {
  data: DataPoint[];
  fileName?: string;
  csvText?: string;
}

type FilterCondition = {
  column: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "between";
  value: string | number;
  value2?: string | number;
};

type SortCondition = {
  column: string;
  direction: "asc" | "desc";
};

type Aggregation = {
  column: string;
  operation: "sum" | "avg" | "min" | "max" | "count" | "std";
};

export function AdvancedAnalyticsDashboard({ data, fileName = "data", csvText }: AdvancedAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<"data" | "charts" | "analysis" | "cleaning">("data");
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [sorts, setSorts] = useState<SortCondition[]>([]);
  const [aggregations, setAggregations] = useState<Aggregation[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  
  // Data cleaning state
  const [cleaningStrategies, setCleaningStrategies] = useState<Record<string, CleanStrategy>>({});
  const [cleaningApplied, setCleaningApplied] = useState(false);
  const [cleanedData, setCleanedData] = useState<DataPoint[] | null>(null);
  const [csvIssues, setCsvIssues] = useState<CsvIssues | null>(null);
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  const [standardizeColumns, setStandardizeColumns] = useState<string[]>([]);

  const columns = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  const currentData = cleaningApplied ? (cleanedData || data) : data;

  const filteredData = useMemo(() => {
    let result = [...currentData];

    // Apply filters
    filters.forEach((filter) => {
      result = result.filter((row) => {
        const cellValue = row[filter.column];
        switch (filter.operator) {
          case "equals":
            return cellValue === filter.value;
          case "not_equals":
            return cellValue !== filter.value;
          case "contains":
            return String(cellValue).toLowerCase().includes(String(filter.value).toLowerCase());
          case "greater_than":
            return Number(cellValue) > Number(filter.value);
          case "less_than":
            return Number(cellValue) < Number(filter.value);
          case "between":
            return Number(cellValue) >= Number(filter.value) && Number(cellValue) <= Number(filter.value2);
          default:
            return true;
        }
      });
    });

    // Apply sorts
    sorts.forEach((sort) => {
      result.sort((a, b) => {
        const aVal = a[sort.column];
        const bVal = b[sort.column];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sort.direction === "asc" ? comparison : -comparison;
      });
    });

    return result;
  }, [currentData, filters, sorts]);

  const aggregatedData = useMemo(() => {
    if (aggregations.length === 0) return null;

    const result: Record<string, number> = {};
    aggregations.forEach((agg) => {
      const values = filteredData.map((row) => Number(row[agg.column])).filter((v) => !isNaN(v));
      
      switch (agg.operation) {
        case "sum":
          result[`${agg.column}_sum`] = values.reduce((a, b) => a + b, 0);
          break;
        case "avg":
          result[`${agg.column}_avg`] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          break;
        case "min":
          result[`${agg.column}_min`] = Math.min(...values);
          break;
        case "max":
          result[`${agg.column}_max`] = Math.max(...values);
          break;
        case "count":
          result[`${agg.column}_count`] = values.length;
          break;
        case "std":
          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
          result[`${agg.column}_std`] = Math.sqrt(variance);
          break;
      }
    });

    return result;
  }, [filteredData, aggregations]);

  const chartFigures = useMemo(() => {
    if (filteredData.length === 0) return [];

    const numericColumns = columns.filter((col) => 
      filteredData.some((row) => typeof row[col] === "number")
    );

    const figures: PlotlyFigure[] = [];

    // Histogram for numeric columns
    numericColumns.forEach((col) => {
      const values = filteredData.map((row) => Number(row[col])).filter((v) => !isNaN(v));
      if (values.length > 0) {
        figures.push({
          data: [{
            type: "histogram",
            x: values,
            marker: { color: "#0ea5e9" },
            name: col,
          }],
          layout: {
            title: { text: `Distribution of ${col}` },
            margin: { t: 40, r: 20, b: 40, l: 40 },
          },
        });
      }
    });

    // Scatter plots for pairs of numeric columns
    if (numericColumns.length >= 2) {
      const xCol = numericColumns[0];
      const yCol = numericColumns[1];
      figures.push({
        data: [{
          type: "scatter",
          mode: "markers",
          x: filteredData.map((row) => Number(row[xCol])),
          y: filteredData.map((row) => Number(row[yCol])),
          marker: { color: "#8b5cf6", size: 8 },
        }],
        layout: {
          title: { text: `${xCol} vs ${yCol}` },
          xaxis: { title: xCol },
          yaxis: { title: yCol },
          margin: { t: 40, r: 20, b: 40, l: 40 },
        },
      });
    }

    // Bar chart for categorical columns
    const categoricalColumns = columns.filter((col) => 
      filteredData.some((row) => typeof row[col] === "string")
    );
    
    categoricalColumns.slice(0, 2).forEach((col) => {
      const counts = filteredData.reduce((acc, row) => {
        const val = String(row[col]);
        acc[val] = (typeof acc[val] === 'number' ? acc[val] : 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      figures.push({
        data: [{
          type: "bar",
          x: Object.keys(counts),
          y: Object.values(counts),
          marker: { color: "#10b981" },
        }],
        layout: {
          title: { text: `Count by ${col}` },
          margin: { t: 40, r: 20, b: 40, l: 40 },
        },
      });
    });

    return figures;
  }, [filteredData, columns]);

  const addFilter = () => {
    if (columns.length > 0) {
      setFilters([...filters, { column: columns[0], operator: "equals", value: "" }]);
    }
  };

  const addSort = () => {
    if (columns.length > 0) {
      setSorts([...sorts, { column: columns[0], direction: "asc" }]);
    }
  };

  const addAggregation = () => {
    if (columns.length > 0) {
      setAggregations([...aggregations, { column: columns[0], operation: "avg" }]);
    }
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const removeSort = (index: number) => {
    setSorts(sorts.filter((_, i) => i !== index));
  };

  const removeAggregation = (index: number) => {
    setAggregations(aggregations.filter((_, i) => i !== index));
  };

  const exportData = () => {
    const headers = columns.join(",");
    const rows = filteredData.map((row) => columns.map((col) => row[col]).join(","));
    const csv = [headers, ...rows].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}_filtered.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAnalysis = () => {
    const analysis = {
      originalRows: data.length,
      filteredRows: filteredData.length,
      filters,
      sorts,
      aggregations,
      aggregatedResults: aggregatedData,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}_analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Data cleaning functions
  const detectIssues = () => {
    if (!csvText) return;
    const csvDataset = {
      filename: fileName,
      csvText,
      nrows: data.length,
      columns: columns,
      targetColumn: columns[columns.length - 1],
    };
    const issues = analyzeCsv(csvDataset);
    setCsvIssues(issues);
    
    // Set default strategies for affected columns
    const defaultStrategies: Record<string, CleanStrategy> = {};
    issues.affected.forEach((col) => {
      defaultStrategies[col] = "median";
    });
    setCleaningStrategies(defaultStrategies);
  };

  const applyDataCleaning = () => {
    if (!csvText || Object.keys(cleaningStrategies).length === 0) return;
    
    const csvDataset = {
      filename: fileName,
      csvText,
      nrows: data.length,
      columns: columns,
      targetColumn: columns[columns.length - 1],
    };
    
    const { dataset, replacements, rowsDropped } = applyCleaning(csvDataset, cleaningStrategies);
    
    // Parse cleaned CSV back to DataPoint format
    const lines = dataset.csvText.split("\n").filter(Boolean);
    const headers = lines[0].split(",");
    const cleanedRows = lines.slice(1).map((line) => {
      const values = line.split(",");
      const row: Record<string, string | number> = {};
      headers.forEach((header, i) => {
        const val = values[i]?.trim() || "";
        const numVal = parseFloat(val);
        row[header.trim()] = isNaN(numVal) ? val : numVal;
      });
      return row;
    });
    
    // Remove duplicates if enabled
    let finalRows = cleanedRows;
    if (removeDuplicates) {
      const seen = new Set<string>();
      finalRows = cleanedRows.filter((row) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    
    // Standardize columns if enabled
    if (standardizeColumns.length > 0) {
      standardizeColumns.forEach((col) => {
        const values = finalRows.map((row) => Number(row[col])).filter((v) => !isNaN(v));
        if (values.length > 0) {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const std = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
          finalRows = finalRows.map((row) => {
            const val = Number(row[col]);
            if (!isNaN(val) && std > 0) {
              return { ...row, [col]: (val - mean) / std };
            }
            return row;
          });
        }
      });
    }
    
    setCleanedData(finalRows);
    setCleaningApplied(true);
  };

  const resetCleaning = () => {
    setCleaningStrategies({});
    setCleaningApplied(false);
    setCleanedData(null);
    setCsvIssues(null);
    setRemoveDuplicates(false);
    setStandardizeColumns([]);
  };

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border">
        <div className="text-center">
          <Table size={32} className="mx-auto text-muted-2" />
          <p className="mt-2 text-sm text-muted">No data available for analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Advanced Analytics Dashboard</h3>
          <p className="text-sm text-muted">
            {filteredData.length} of {data.length} rows displayed
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportData}>
            <DownloadSimple size={16} /> Export Data
          </Button>
          <Button variant="ghost" size="sm" onClick={exportAnalysis}>
            <DownloadSimple size={16} /> Export Analysis
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("data")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "data"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted hover:text-foreground"
          )}
        >
          <Table size={16} className="mr-2 inline" /> Data View
        </button>
        <button
          onClick={() => setActiveTab("charts")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "charts"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted hover:text-foreground"
          )}
        >
          <ChartLine size={16} className="mr-2 inline" /> Charts
        </button>
        <button
          onClick={() => setActiveTab("analysis")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "analysis"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted hover:text-foreground"
          )}
        >
          <Calculator size={16} className="mr-2 inline" /> Analysis
        </button>
        <button
          onClick={() => {
            setActiveTab("cleaning");
            if (!csvIssues && csvText) detectIssues();
          }}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "cleaning"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted hover:text-foreground"
          )}
        >
          <Broom size={16} className="mr-2 inline" /> Cleaning
        </button>
      </div>

      {/* Controls Panel */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={addFilter}>
            <Funnel size={16} className="mr-2" /> Add Filter
          </Button>
          <Button variant="outline" size="sm" onClick={addSort}>
            <SortAscending size={16} className="mr-2" /> Add Sort
          </Button>
          <Button variant="outline" size="sm" onClick={addAggregation}>
            <Calculator size={16} className="mr-2" /> Add Aggregation
          </Button>
          {(filters.length > 0 || sorts.length > 0 || aggregations.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters([]);
                setSorts([]);
                setAggregations([]);
              }}
            >
              <Trash size={16} className="mr-2" /> Clear All
            </Button>
          )}
        </div>

        {/* Active Filters */}
        {filters.length > 0 && (
          <div className="mb-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Filters</p>
            {filters.map((filter, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-foreground/[0.04] p-2">
                <select
                  value={filter.column}
                  onChange={(e) => {
                    const newFilters = [...filters];
                    newFilters[i].column = e.target.value;
                    setFilters(newFilters);
                  }}
                  className="h-8 rounded border border-border bg-background px-2 text-xs"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <select
                  value={filter.operator}
                  onChange={(e) => {
                    const newFilters = [...filters];
                    newFilters[i].operator = e.target.value as any;
                    setFilters(newFilters);
                  }}
                  className="h-8 rounded border border-border bg-background px-2 text-xs"
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Not Equals</option>
                  <option value="contains">Contains</option>
                  <option value="greater_than">Greater Than</option>
                  <option value="less_than">Less Than</option>
                  <option value="between">Between</option>
                </select>
                <input
                  type="text"
                  value={String(filter.value)}
                  onChange={(e) => {
                    const newFilters = [...filters];
                    newFilters[i].value = e.target.value;
                    setFilters(newFilters);
                  }}
                  className="h-8 w-24 rounded border border-border bg-background px-2 text-xs"
                  placeholder="Value"
                />
                {filter.operator === "between" && (
                  <input
                    type="text"
                    value={String(filter.value2 || "")}
                    onChange={(e) => {
                      const newFilters = [...filters];
                      newFilters[i].value2 = e.target.value;
                      setFilters(newFilters);
                    }}
                    className="h-8 w-24 rounded border border-border bg-background px-2 text-xs"
                    placeholder="To"
                  />
                )}
                <Button variant="ghost" size="icon" onClick={() => removeFilter(i)}>
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Active Sorts */}
        {sorts.length > 0 && (
          <div className="mb-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sorting</p>
            {sorts.map((sort, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-foreground/[0.04] p-2">
                <select
                  value={sort.column}
                  onChange={(e) => {
                    const newSorts = [...sorts];
                    newSorts[i].column = e.target.value;
                    setSorts(newSorts);
                  }}
                  className="h-8 rounded border border-border bg-background px-2 text-xs"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <select
                  value={sort.direction}
                  onChange={(e) => {
                    const newSorts = [...sorts];
                    newSorts[i].direction = e.target.value as any;
                    setSorts(newSorts);
                  }}
                  className="h-8 rounded border border-border bg-background px-2 text-xs"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
                <Button variant="ghost" size="icon" onClick={() => removeSort(i)}>
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Active Aggregations */}
        {aggregations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Aggregations</p>
            {aggregations.map((agg, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-foreground/[0.04] p-2">
                <select
                  value={agg.column}
                  onChange={(e) => {
                    const newAggs = [...aggregations];
                    newAggs[i].column = e.target.value;
                    setAggregations(newAggs);
                  }}
                  className="h-8 rounded border border-border bg-background px-2 text-xs"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <select
                  value={agg.operation}
                  onChange={(e) => {
                    const newAggs = [...aggregations];
                    newAggs[i].operation = e.target.value as any;
                    setAggregations(newAggs);
                  }}
                  className="h-8 rounded border border-border bg-background px-2 text-xs"
                >
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                  <option value="min">Min</option>
                  <option value="max">Max</option>
                  <option value="count">Count</option>
                  <option value="std">Std Dev</option>
                </select>
                <Button variant="ghost" size="icon" onClick={() => removeAggregation(i)}>
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === "data" && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="scroll-thin max-h-96 overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-muted">
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2 font-medium">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-t border-border/60 font-mono">
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-1.5">
                        {String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredData.length > 100 && (
            <div className="border-t border-border bg-foreground/[0.02] px-3 py-2 text-[10.5px] text-muted">
              Showing 100 of {filteredData.length} filtered rows
            </div>
          )}
        </div>
      )}

      {activeTab === "charts" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {chartFigures.length > 0 ? (
            chartFigures.map((figure, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-4">
                <div className="h-[300px]">
                  <PlotlyChart figure={figure} />
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 rounded-xl border border-dashed border-border bg-foreground/[0.02] px-5 py-10 text-center">
              <ChartBar size={32} className="mx-auto text-muted-2" />
              <p className="mt-2 text-sm font-medium text-foreground-2">No charts available</p>
              <p className="mt-1 text-xs text-muted">Filter or modify data to generate visualizations</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "analysis" && (
        <div className="space-y-4">
          {aggregatedData ? (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h4 className="mb-3 text-sm font-semibold tracking-tight">Aggregation Results</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(aggregatedData).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-border bg-foreground/[0.04] p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{key}</p>
                    <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                      {typeof value === "number" ? value.toFixed(4) : value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-foreground/[0.02] px-5 py-10 text-center">
              <Calculator size={32} className="mx-auto text-muted-2" />
              <p className="mt-2 text-sm font-medium text-foreground-2">No aggregations</p>
              <p className="mt-1 text-xs text-muted">Add aggregations to see computed statistics</p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-4">
            <h4 className="mb-3 text-sm font-semibold tracking-tight">Data Statistics</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-foreground/[0.04] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Total Rows</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums">{data.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-foreground/[0.04] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Filtered Rows</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums">{filteredData.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-foreground/[0.04] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Columns</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums">{columns.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-foreground/[0.04] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Filters Applied</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums">{filters.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "cleaning" && (
        <div className="space-y-4">
          {!csvText ? (
            <div className="rounded-xl border border-dashed border-border bg-foreground/[0.02] px-5 py-10 text-center">
              <Broom size={32} className="mx-auto text-muted-2" />
              <p className="mt-2 text-sm font-medium text-foreground-2">CSV text not available</p>
              <p className="mt-1 text-xs text-muted">Data cleaning requires the original CSV text</p>
            </div>
          ) : (
            <>
              {/* Issues Summary */}
              {csvIssues && (
                <div className="rounded-xl border border-border bg-surface p-4">
                  <h4 className="mb-3 text-sm font-semibold tracking-tight">Detected Issues</h4>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className={cn("rounded-lg border border-border bg-foreground/[0.04] p-3", csvIssues.missingTotal > 0 ? "border-amber-500/50 bg-amber-500/10" : "")}>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Missing Values</p>
                      <p className="mt-1 font-mono text-lg font-bold tabular-nums">{csvIssues.missingTotal}</p>
                    </div>
                    <div className={cn("rounded-lg border border-border bg-foreground/[0.04] p-3", csvIssues.duplicateRows > 0 ? "border-amber-500/50 bg-amber-500/10" : "")}>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Duplicate Rows</p>
                      <p className="mt-1 font-mono text-lg font-bold tabular-nums">{csvIssues.duplicateRows}</p>
                    </div>
                    <div className={cn("rounded-lg border border-border bg-foreground/[0.04] p-3", csvIssues.columns.length > 0 ? "border-amber-500/50 bg-amber-500/10" : "")}>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Column Issues</p>
                      <p className="mt-1 font-mono text-lg font-bold tabular-nums">{csvIssues.columns.length}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cleaning Strategies */}
              {csvIssues && csvIssues.affected.length > 0 && (
                <div className="rounded-xl border border-border bg-surface p-4">
                  <h4 className="mb-3 text-sm font-semibold tracking-tight">Missing Value Strategies</h4>
                  <div className="space-y-2">
                    {csvIssues.affected.map((col) => (
                      <div key={col} className="flex items-center gap-2 rounded-lg bg-foreground/[0.04] p-2">
                        <span className="flex-1 text-xs font-medium">{col}</span>
                        <select
                          value={cleaningStrategies[col] || "median"}
                          onChange={(e) => {
                            setCleaningStrategies({ ...cleaningStrategies, [col]: e.target.value as CleanStrategy });
                          }}
                          className="h-8 rounded border border-border bg-background px-2 text-xs"
                        >
                          <option value="mean">Mean</option>
                          <option value="median">Median</option>
                          <option value="mode">Mode</option>
                          <option value="zero">Zero</option>
                          <option value="drop">Drop Rows</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Cleaning Options */}
              <div className="rounded-xl border border-border bg-surface p-4">
                <h4 className="mb-3 text-sm font-semibold tracking-tight">Additional Options</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={removeDuplicates}
                      onChange={(e) => setRemoveDuplicates(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-xs">Remove duplicate rows</span>
                  </label>
                  
                  <div>
                    <p className="mb-2 text-xs font-medium">Standardize columns (z-score normalization)</p>
                    <div className="flex flex-wrap gap-2">
                      {columns.filter((col) => {
                        const values = data.slice(0, 100).map((row) => Number(row[col]));
                        return values.some((v) => !isNaN(v));
                      }).map((col) => (
                        <label key={col} className="flex items-center gap-1 cursor-pointer rounded border border-border bg-foreground/[0.04] px-2 py-1">
                          <input
                            type="checkbox"
                            checked={standardizeColumns.includes(col)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setStandardizeColumns([...standardizeColumns, col]);
                              } else {
                                setStandardizeColumns(standardizeColumns.filter((c) => c !== col));
                              }
                            }}
                            className="h-3 w-3 rounded border-border"
                          />
                          <span className="text-[10px]">{col}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {!cleaningApplied ? (
                  <Button onClick={applyDataCleaning} disabled={!csvIssues || Object.keys(cleaningStrategies).length === 0}>
                    <Broom size={16} className="mr-2" /> Apply Cleaning
                  </Button>
                ) : (
                  <>
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2">
                      <CheckCircle size={16} className="text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Cleaning applied - {cleanedData?.length || 0} rows
                      </span>
                    </div>
                    <Button variant="outline" onClick={resetCleaning}>
                      <X size={16} className="mr-2" /> Reset
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AdvancedAnalyticsDashboard;
