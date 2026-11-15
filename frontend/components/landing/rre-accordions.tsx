"use client";

import { Plus, Minus } from "lucide-react";
import { useState } from "react";

interface AccordionItem {
  id: string;
  title: string;
  body: string;
}

const items: AccordionItem[] = [
  {
    id: "chat",
    title: "Start in Chat",
    body: "Ask Brigid about bank reconciliation, upcoming invoices, or weekly cash flow. Questions and ledger context stay together in one conversation.",
  },
  {
    id: "guardrails",
    title: "Deterministic policy guard",
    body: "Every proposed payment is checked against fixed mandate rules, cash buffer limits, duplicate checks, and registered supplier accounts before it can be queued.",
  },
  {
    id: "mandates",
    title: "Owner-reviewed mandates",
    body: "Draft spending boundaries in Mandate. Drafts do not take effect until the account owner reviews and confirms the change.",
  },
  {
    id: "approvals",
    title: "Out-of-band approvals",
    body: "Requests that exceed automatic thresholds wait in Approvals with a one-time confirmation token that never passes through the language model.",
  },
];

export function RreAccordions() {
  const [openId, setOpenId] = useState<string | null>("chat");

  return (
    <div className="rre-accordions">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className="rre-accordion-item">
            <h3>
              <button
                type="button"
                className="rre-accordion-trigger"
                aria-expanded={isOpen}
                aria-controls={`acc-panel-${item.id}`}
                onClick={() => setOpenId(isOpen ? null : item.id)}
              >
                <span>{item.title}</span>
                {isOpen ? (
                  <Minus
                    size={20}
                    strokeWidth={1.5}
                    className="rre-accordion-icon"
                    aria-hidden="true"
                  />
                ) : (
                  <Plus
                    size={20}
                    strokeWidth={1.5}
                    className="rre-accordion-icon"
                    aria-hidden="true"
                  />
                )}
              </button>
            </h3>
            <div
              id={`acc-panel-${item.id}`}
              className={`rre-accordion-panel ${isOpen ? "is-open" : ""}`}
              hidden={!isOpen}
            >
              <p>{item.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
