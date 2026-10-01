/** Sounds made on the spot with Web Audio — no file to load or cache. */
export const TONES = ["chime", "bell", "alert", "beep"] as const;
export type Tone = (typeof TONES)[number];

/** One note: a wave at a pitch, rising fast and dying away. */
const note = (
	context: AudioContext,
	{ freq, at, length, type = "sine", peak = 0.25 }: { freq: number; at: number; length: number; type?: OscillatorType; peak?: number }
) => {
	const start = context.currentTime + at;
	const osc = context.createOscillator();
	const gain = context.createGain();
	osc.type = type;
	osc.frequency.value = freq;
	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
	osc.connect(gain).connect(context.destination);
	osc.start(start);
	osc.stop(start + length + 0.05);
};

/**
 * The new-order sounds, made on the spot — no audio file to load or cache. From soft to
 * loud: a counter with music on wants the chime, a kitchen with a fryer going wants the alert.
 */
export const play = (context: AudioContext, tone: Tone) => {
	switch (tone) {
		case "chime": // two rising notes
			note(context, { freq: 880, at: 0, length: 0.35 });
			note(context, { freq: 1320, at: 0.16, length: 0.35 });
			break;
		case "bell": // a service bell: one bright strike with a long ring and an overtone
			note(context, { freq: 1568, at: 0, length: 1.4, peak: 0.3 });
			note(context, { freq: 3136, at: 0, length: 0.8, peak: 0.08 });
			break;
		case "alert": // three hard beeps, repeated: cuts through a noisy kitchen
			for (let i = 0; i < 6; i++) note(context, { freq: i % 3 === 2 ? 1175 : 988, at: i * 0.14 + (i >= 3 ? 0.25 : 0), length: 0.1, type: "square", peak: 0.12 });
			break;
		case "beep": // one short, quiet pip
			note(context, { freq: 740, at: 0, length: 0.18, type: "triangle", peak: 0.22 });
			break;
	}
};
