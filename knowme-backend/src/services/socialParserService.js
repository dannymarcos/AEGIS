export function extractHashtags(text = '') {
  const tags = [...new Set((text.match(/#[\p{L}\p{N}_]+/gu) || []).map((raw) => raw.slice(1).toLowerCase()))];
  return tags;
}

export function extractMentions(text = '') {
  const mentions = [...new Set((text.match(/@[\p{L}\p{N}._-]+/gu) || []).map((raw) => raw.slice(1).toLowerCase()))];
  return mentions;
}

export function inferPostType(media = []) {
  if (!Array.isArray(media) || media.length === 0) return 'TEXT';
  if (media.length === 1) return 'IMAGE';
  return 'CAROUSEL';
}
