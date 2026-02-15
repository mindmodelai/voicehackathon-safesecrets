import styles from './AboutModal.module.css';

interface AboutModalProps {
  onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close about dialog">✕</button>

        <h1 className={styles.title}>SafeSecrets</h1>
        <p className={styles.subtitle}>AI-Powered Love Note Assistant</p>

        {/* Development */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Development</h2>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>⚡ Velocity</h3>
            <p>Approximately 900 Kiro credits at $0.02/credit (~$18.00 USD)</p>
            <p className={styles.muted}>Built using two Kiro instances with separate Kiro Plus accounts under AWS IAM Identity Center management, providing enterprise-grade privacy controls and centralized identity governance. Offering reliable access to Opus 4.6 without rate limits and attractive pricing.</p>
          </div>

          <div className={styles.cardRow}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>🎨 Visuals</h3>
              <p>Image Generation: Google Gemini 3.0</p>
              <p>Video Generation: Google Veo 3.1</p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>📐 Diagrams</h3>
              <p>Multi-region AWS architecture with sovereignty mode selection</p>
              <p>EC2 (t3.large) in ca-central-1</p>
            </div>
          </div>
        </section>

        {/* Orchestration */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Orchestration</h2>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>🎙️ Custom Voice Provider</h3>
            <p><code>SafeSecretsVoiceProvider extends MastraVoice</code></p>
            <p>Bridges Mastra's voice interface with AWS Transcribe (STT) and AWS Polly (TTS), and connects to the Mastra Agent's LLM (Amazon Bedrock — Claude 3 Haiku via <code>@ai-sdk/amazon-bedrock</code>) for structured conversational inference.</p>
            <ul className={styles.featureList}>
              <li><code>listen()</code> — Streams audio through Transcribe, returns final transcript</li>
              <li><code>speak()</code> — Synthesizes speech via Polly, returns audio stream</li>
              <li><code>stopSpeaking()</code> — Barge-in by aborting active TTS</li>
              <li>Regional configuration pinned to ca-central-1 by default, configurable per sovereignty mode</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>🔧 Mastra Workflow Engine</h3>
            <p>Framework: <code>@mastra/core</code> with Agent and Workflow primitives</p>
            <p>Three-stage pipeline: <span className={styles.tag}>Collect</span> → <span className={styles.tag}>Compose</span> → <span className={styles.tag}>Refine</span></p>
            <ul className={styles.featureList}>
              <li>Stateful session management with full history tracking</li>
              <li>Automatic stage transitions when context is complete</li>
              <li>Zod schema validation with automatic retry on malformed responses</li>
              <li>Real-time UI updates via onStyleUpdate and onNoteDraftUpdate hooks</li>
              <li>Immutable context fields during refinement stage</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>🎬 Phoneme-Based Avatar Video Selection</h3>
            <p>Bedrock tags the first phoneme of each spoken response, and the frontend plays the matching mouth-shape transition video before entering the speaking loop.</p>
            <ul className={styles.featureList}>
              <li>Six phoneme groups: MBP (closed lips), TDNL (small open), AHAA (wide open), OUW (rounded), EE (smile spread), FV (teeth/lip contact)</li>
              <li>Each group has a 0.5s transition clip that bridges into the main speaking animation</li>
              <li>Thinking state randomly seeks into a multi-segment thinking video for visual variety</li>
              <li>State flow: Idle → Listening → Thinking → Phoneme Transition → Speaking Loop → Idle</li>
            </ul>
          </div>
        </section>

        {/* Service Adapters */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>AWS &amp; Third-Party Service Adapters</h2>

          <div className={styles.cardRow}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>📝 TranscribeAdapter</h3>
              <p>Real-time speech-to-text streaming</p>
              <ul className={styles.featureList}>
                <li>Session-based stream management</li>
                <li>Async generator pattern for audio chunks</li>
                <li>Dual callbacks: partial + final transcripts</li>
                <li>Multi-region: ca-central-1, us-east-1</li>
              </ul>
              <p className={styles.muted}>16kHz PCM, English (US)</p>
            </div>

            <div className={styles.card}>
              <h3 className={styles.cardTitle}>🔊 PollyAdapter</h3>
              <p>Neural and Generative TTS</p>
              <ul className={styles.featureList}>
                <li>Dual engine: Neural (CA) + Generative (US)</li>
                <li>4KB streaming chunks for low latency</li>
                <li>Abort controller for barge-in</li>
                <li>Voice: Joanna</li>
              </ul>
              <p className={styles.muted}>PCM at 16kHz, 4096-byte chunks</p>
            </div>

            <div className={styles.card}>
              <h3 className={styles.cardTitle}>⚡ SmallestAdapter</h3>
              <p>Smallest.ai Waves API</p>
              <ul className={styles.featureList}>
                <li>Lightning v3.1 engine</li>
                <li>Voice: Sophia at 1.25x speed</li>
                <li>Bearer token authentication</li>
                <li>Abort controller for barge-in</li>
              </ul>
              <p className={styles.muted}>Streaming PCM at 16kHz, speed range 0.5x–2.0x</p>
            </div>
          </div>
        </section>

        {/* Prompt Engineering */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Prompt Engineering</h2>
          <div className={styles.cardRow}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>📋 Collect</h3>
              <p>Tracks missing context fields (recipient, situation, tone, outcome)</p>
              <p>Generates friendly clarifying questions</p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>✍️ Compose</h3>
              <p>Synthesizes personalized love note from complete context</p>
              <p>Generates descriptive tags (#sweet, #romantic)</p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>🔄 Refine</h3>
              <p>Preserves immutable context, updates only noteDraft</p>
              <p>Supports: shorter, bolder, more romantic, translate to French</p>
            </div>
          </div>
        </section>

        {/* Error Handling */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Error Handling &amp; Resilience</h2>
          <div className={styles.cardRow}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>🛡️ Bedrock Validation</h3>
              <ul className={styles.featureList}>
                <li>Custom BedrockValidationError for schema violations</li>
                <li>Automatic single retry on invalid responses</li>
                <li>JSON fence stripping for markdown-wrapped responses</li>
              </ul>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>🔇 TTS Abort Handling</h3>
              <ul className={styles.featureList}>
                <li>Unified abort controller across Polly and Smallest</li>
                <li>Silent resolution on intentional cancellation</li>
                <li>Chunk-level abort checking for responsive cancellation</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Sovereignty Modes */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sovereignty Modes</h2>
          <p className={styles.sectionIntro}>Four data residency configurations — choose where your data is processed:</p>

          <div className={styles.sovereigntyTable}>
            <div className={styles.sovereigntyRow}>
              <span className={styles.sovereigntyFlag}>🇨🇦</span>
              <div>
                <strong>Full Canada</strong>
                <p className={styles.muted}>All services → ca-central-1 · Polly Neural</p>
              </div>
            </div>
            <div className={styles.sovereigntyRow}>
              <span className={styles.sovereigntyFlag}>🇨🇦</span>
              <div>
                <strong>Canada + US Voice</strong>
                <p className={styles.muted}>Bedrock/Transcribe → ca-central-1 · Polly Generative → us-east-1</p>
              </div>
            </div>
            <div className={styles.sovereigntyRow}>
              <span className={styles.sovereigntyFlag}>🇺🇸</span>
              <div>
                <strong>US Bedrock + Voice</strong>
                <p className={styles.muted}>All AWS → us-east-1 · Polly Generative</p>
              </div>
            </div>
            <div className={styles.sovereigntyRow}>
              <span className={styles.sovereigntyFlag}>🇺🇸</span>
              <div>
                <strong>Full US + Smallest.ai</strong>
                <p className={styles.muted}>All AWS → us-east-1 · Smallest.ai Lightning v3.1</p>
              </div>
            </div>
          </div>
        </section>

        {/* Infrastructure */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Infrastructure</h2>
          <div className={styles.card}>
            <ul className={styles.featureList}>
              <li>AWS EC2 t3.large in ca-central-1</li>
              <li>IAM Role with multi-region Bedrock, Transcribe, and Polly permissions</li>
              <li>Security Group: SSH (22), HTTP (80), HTTPS (443), WebSocket (3000)</li>
              <li>Node.js backend with WebSocket server</li>
              <li>React frontend with real-time audio streaming</li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}
