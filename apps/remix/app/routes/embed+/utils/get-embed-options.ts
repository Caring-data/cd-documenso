export type EmbedOptions = {
  externalId?: string;
  isSystem?: boolean;
  onTemplateCompleted?: boolean;
  onTemplateReady?: boolean;
  onTemplateError?: boolean;
};

export function getEmbedOptions(): EmbedOptions {
  const hash = typeof window !== 'undefined' ? window.location.hash?.slice(1) : '';
  if (!hash) {
    return {};
  }
  try {
    return JSON.parse(decodeURIComponent(atob(hash))) as EmbedOptions;
  } catch {
    return {};
  }
}
