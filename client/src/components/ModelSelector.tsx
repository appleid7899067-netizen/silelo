import React from "react";
import { Cpu } from "lucide-react";
type Model = { id: string; label: string; state: "ready" | "setup" | "unsupported" };

type Props = { models: Model[]; value: string; onChange: (value: string) => void };

export function ModelSelector({ models, value, onChange }: Props) {
  const readyModels = models.filter(model => model.state === "ready");
  const active = readyModels.find(model => model.id === value);
  return <div className="model-select-wrap"><Cpu size={14} /><select aria-label="เลือกโมเดล" value={value} onChange={event => onChange(event.target.value)}>{readyModels.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}</select><span className="model-state"><span className="status-badge status-ready">✓ พร้อมใช้</span></span></div>;
}
