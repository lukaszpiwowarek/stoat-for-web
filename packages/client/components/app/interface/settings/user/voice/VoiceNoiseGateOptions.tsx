import { Show } from "solid-js";

import { Trans } from "@lingui-solid/solid/macro";

import { useVoice } from "@revolt/rtc/state";
import { useState } from "@revolt/state";
import { CategoryButton, Checkbox, Column, Slider, Text } from "@revolt/ui";

/**
 * Noise gate options
 */
export function VoiceNoiseGateOptions() {
  const state = useState();
  const voice = useVoice();

  return (
    <Column>
      <Text class="title">
        <Trans>Noise Gate</Trans>
      </Text>
      <CategoryButton.Group>
        <CategoryButton
          icon="blank"
          action={<Checkbox checked={state.voice.noiseGateEnabled} />}
          onClick={() => voice.setNoiseGateEnabled(!state.voice.noiseGateEnabled)}
        >
          <Trans>Enable Noise Gate</Trans>
        </CategoryButton>
      </CategoryButton.Group>
      <Show when={state.voice.noiseGateEnabled}>
        <Column>
          <Text class="label">
            <Trans>Threshold</Trans>
          </Text>
          <Slider
            min={-80}
            max={-20}
            step={1}
            value={state.voice.noiseGateThreshold}
            onChange={(event) =>
              voice.setNoiseGateThreshold(event.currentTarget.value)
            }
            labelFormatter={(value) => `${value} dB`}
          />
          <Text class="label">
            <Trans>Hysteresis</Trans>
          </Text>
          <Slider
            min={5}
            max={30}
            step={1}
            value={state.voice.noiseGateHysteresis}
            onChange={(event) =>
              voice.setNoiseGateHysteresis(event.currentTarget.value)
            }
            labelFormatter={(value) => `${value} dB`}
          />
        </Column>
      </Show>
    </Column>
  );
}
