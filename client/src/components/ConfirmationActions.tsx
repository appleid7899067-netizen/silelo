import React from "react";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { message: string; onConfirm: () => void; onCancel: () => void };

export function ConfirmationActions({ message, onConfirm, onCancel }: Props) {
  return <div className="confirmation-banner"><div className="confirmation-icon"><ShieldCheck size={18} /></div><div className="confirmation-copy"><strong>ต้องยืนยันก่อนดำเนินการ</strong><span>{message}</span></div><div className="confirmation-actions"><Button size="sm" onClick={onConfirm}><Check size={14} />ยืนยัน</Button><Button size="sm" variant="ghost" onClick={onCancel}>ยกเลิก</Button></div></div>;
}
