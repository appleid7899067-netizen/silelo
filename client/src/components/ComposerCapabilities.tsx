import React from "react";
import { composerCapabilityLabels, type ComposerRuntime } from "../../../shared/composer";

type Props = { runtime: ComposerRuntime };

export function ComposerCapabilities({ runtime }: Props) {
  const labels = composerCapabilityLabels(runtime);
  return <div className="composer-capabilities" aria-label="สถานะความสามารถของ composer"><span>{labels.file}</span><span>{labels.voice}</span><span>{labels.githubRead}</span><span>{labels.githubWrite}</span></div>;
}
