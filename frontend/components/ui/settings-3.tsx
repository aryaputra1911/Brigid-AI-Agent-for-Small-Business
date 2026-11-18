"use client";

import * as React from "react";
import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export interface SettingsRow {
  key: string;
  label: string;
  value: string;
}

const initialRows: SettingsRow[] = [
  { key: "name", label: "Full name", value: "Ada Lovelace" },
  { key: "email", label: "Email", value: "ada@acme.com" },
  { key: "phone", label: "Phone", value: "+1 555 0142" },
];

export interface Settings3Props {
  rows?: SettingsRow[];
  title?: string;
  description?: string;
  onSave?: (key: string, value: string) => void;
  footer?: React.ReactNode;
  className?: string;
}

export function Settings3({
  rows: externalRows,
  title = "Personal info",
  description = "Edit one field at a time, in place.",
  onSave,
  footer,
  className,
}: Settings3Props) {
  const [internalRows, setInternalRows] = useState(initialRows);
  const rows = externalRows ?? internalRows;
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function startEdit(row: SettingsRow) {
    setEditing(row.key);
    setDraft(row.value);
  }

  function save(key: string) {
    if (onSave) {
      onSave(key, draft);
    } else {
      setInternalRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, value: draft } : r)),
      );
    }
    setEditing(null);
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-white/70">{description}</p>
      </CardHeader>

      <CardContent className="flex flex-col">
        {rows.map((row, i) => (
          <div key={row.key}>
            {i > 0 && <Separator />}
            <div className="flex items-center justify-between gap-4 py-3.5">
              {editing === row.key ? (
                <>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Label htmlFor={`ie-${row.key}`} className="text-xs">
                      {row.label}
                    </Label>
                    <Input
                      id={`ie-${row.key}`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          save(row.key);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setEditing(null);
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="mt-5 flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditing(null)}
                      aria-label="Cancel"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => save(row.key)}
                      aria-label="Save"
                    >
                      <Check className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs text-white/65">{row.label}</span>
                    <span className="truncate text-sm font-medium text-white">
                      {row.value}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    aria-label={`Edit ${row.label}`}
                    onClick={() => startEdit(row)}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      {footer && (
        <CardFooter className="flex flex-wrap items-center gap-3 border-t border-white/15 pt-5">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}

export default Settings3;
