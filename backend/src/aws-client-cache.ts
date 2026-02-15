import { TranscribeStreamingClient } from '@aws-sdk/client-transcribe-streaming';
import { PollyClient } from '@aws-sdk/client-polly';

// Cache for AWS SDK clients to enable connection reuse
const transcribeClients = new Map<string, TranscribeStreamingClient>();
const pollyClients = new Map<string, PollyClient>();

/**
 * Returns a cached TranscribeStreamingClient for the given region,
 * or creates a new one if it doesn't exist.
 */
export function getTranscribeClient(region: string): TranscribeStreamingClient {
  if (!transcribeClients.has(region)) {
    transcribeClients.set(region, new TranscribeStreamingClient({ region }));
  }
  return transcribeClients.get(region)!;
}

/**
 * Returns a cached PollyClient for the given region,
 * or creates a new one if it doesn't exist.
 */
export function getPollyClient(region: string): PollyClient {
  if (!pollyClients.has(region)) {
    pollyClients.set(region, new PollyClient({ region }));
  }
  return pollyClients.get(region)!;
}
