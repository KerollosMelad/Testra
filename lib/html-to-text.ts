/**
 * Utility functions to convert HTML content from Azure DevOps to clean, readable text
 */

/**
 * Converts HTML content to clean text, preserving structure for acceptance criteria
 */
export function htmlToText(html: string | null): string | null {
  if (!html) return null;
  
  // If it's not HTML content, return as-is
  if (!html.includes('<') || !html.includes('>')) {
    return html.trim();
  }

  try {
    return cleanHtmlToText(html);
  } catch (error) {
    console.error('Error converting HTML to text:', error);
    // Fallback: simple tag removal
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/**
 * Specifically for acceptance criteria - extracts and formats criteria as a clean list
 */
export function htmlAcceptanceCriteriaToText(html: string | null): string | null {
  if (!html) return null;
  
  // If it's not HTML content, return as-is
  if (!html.includes('<') || !html.includes('>')) {
    return html.trim();
  }

  try {
    // Extract criteria from HTML list items
    const criteria = extractCriteriaFromHTML(html);
    
    if (criteria.length > 0) {
      // Format as a clean numbered list
      return criteria
        .map((criterion, index) => `${index + 1}. ${criterion}`)
        .join('\n');
    }
    
    // Fallback to general HTML to text conversion
    return cleanHtmlToText(html);
  } catch (error) {
    console.error('Error converting HTML acceptance criteria to text:', error);
    return htmlToText(html);
  }
}

/**
 * Extract acceptance criteria from HTML list items
 */
function extractCriteriaFromHTML(html: string): string[] {
  const criteria: string[] = [];

  // Extract from <li> tags (most common in Azure DevOps)
  const liMatches = html.match(/<li[^>]*>(.*?)<\/li>/gi);
  if (liMatches && liMatches.length > 0) {
    const extracted = liMatches
      .map(li => cleanHtmlText(li.replace(/<\/?li[^>]*>/gi, '')))
      .filter(text => text.length > 5); // Filter out very short items
    
    if (extracted.length > 0) {
      criteria.push(...extracted);
    }
  }

  // If no <li> found, try paragraphs that might contain criteria
  if (criteria.length === 0) {
    const pMatches = html.match(/<p[^>]*>(.*?)<\/p>/gi);
    if (pMatches) {
      const extracted = pMatches
        .map(p => cleanHtmlText(p.replace(/<\/?p[^>]*>/gi, '')))
        .filter(text => 
          text.length > 20 && 
          (text.toLowerCase().includes('must') || 
           text.toLowerCase().includes('should') ||
           text.toLowerCase().includes('can') ||
           text.toLowerCase().includes('will') ||
           text.includes('.'))) // Likely to be a criterion
        .slice(0, 15); // Reasonable limit
      
      if (extracted.length > 0) {
        criteria.push(...extracted);
      }
    }
  }

  // If still no criteria, try looking for text after "acceptance criteria" header
  if (criteria.length === 0) {
    const afterHeader = html.match(/(?:acceptance criteria|criteria)[:\s]*(?:<[^>]*>)*\s*(.*?)(?=<\/|$)/i);
    if (afterHeader && afterHeader[1]) {
      const headerText = cleanHtmlText(afterHeader[1]);
      if (headerText.length > 10) {
        // Try to split by common separators
        const split = headerText
          .split(/[.\n]/)
          .map(s => s.trim())
          .filter(s => s.length > 10);
        
        if (split.length > 1) {
          criteria.push(...split);
        } else {
          criteria.push(headerText);
        }
      }
    }
  }

  return criteria;
}

/**
 * Convert general HTML content to clean text while preserving some structure
 */
function cleanHtmlToText(html: string): string {
  let text = html;

  // Convert common HTML structures to text equivalents
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<h[1-6][^>]*>/gi, '\n\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  
  // Handle strong/bold text - keep the text but remove tags
  text = text.replace(/<\/?strong[^>]*>/gi, '');
  text = text.replace(/<\/?b[^>]*>/gi, '');
  text = text.replace(/<\/?em[^>]*>/gi, '');
  text = text.replace(/<\/?i[^>]*>/gi, '');
  
  // Remove all other HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  
  // Clean up the text
  return cleanHtmlText(text);
}

/**
 * Clean and normalize text content
 */
function cleanHtmlText(text: string): string {
  return text
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '...')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Convert Azure DevOps user story format to clean text
 */
export function cleanUserStoryDescription(html: string | null): string | null {
  if (!html) return null;
  
  let text = htmlToText(html);
  if (!text) return null;

  // Clean up common Azure DevOps user story patterns
  text = text.replace(/^\s*As a\s+/i, 'As a ');
  text = text.replace(/\s*I want to\s+/i, '\nI want to ');
  text = text.replace(/\s*So that\s+/i, '\nSo that ');
  
  return text;
} 