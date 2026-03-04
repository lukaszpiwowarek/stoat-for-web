import { Column } from "@revolt/ui";

import { VoiceInputOptions } from "./VoiceInputOptions";
import { VoiceNoiseGateOptions } from "./VoiceNoiseGateOptions";
import { VoiceProcessingOptions } from "./VoiceProcessingOptions";

/**
 * Configure voice options
 */
export function VoiceSettings() {
  return (
    <Column gap="lg">
      <VoiceInputOptions />
      <VoiceProcessingOptions />
      <VoiceNoiseGateOptions />
    </Column>
  );
}
