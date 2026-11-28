/**
 * SEO Studio Templates — WordPress PHP & Plugin Exporter
 * 
 * Generates:
 * - Compatible PHP template partials for theme integration
 * - JSON and CSV import structures supporting Yoast SEO and Rank Math custom fields
 */

export interface WordPressExportPayload {
  postTitle: string;
  postName: string; // slug
  postContent: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
  focusKeyword?: string;
  schemaJsonLd?: string;
}

export interface WordPressImportRecord {
  post_title: string;
  post_name: string;
  post_content: string;
  post_status: string;
  // Yoast SEO mappings
  _yoast_wpseo_title: string;
  _yoast_wpseo_metadesc: string;
  _yoast_wpseo_canonical?: string;
  _yoast_wpseo_focuskw?: string;
  // Rank Math mappings
  rank_math_title: string;
  rank_math_description: string;
  rank_math_canonical_url?: string;
  rank_math_focus_keyword?: string;
}

/**
 * Generates a WordPress PHP partial template file.
 */
export function exportToWordPressPhp(payload: WordPressExportPayload): string {
  return `<?php
/**
 * SEO Studio Templates — WordPress Template Partial
 * Post: ${payload.postTitle}
 * Slug: ${payload.postName}
 */
if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}
?>
<div class="seo-studio-wordpress-entry post-<?php the_ID(); ?>">
  <header class="entry-header">
    <h1 class="entry-title"><?php echo esc_html('${payload.postTitle.replace(/'/g, "\\'")}'); ?></h1>
  </header>
  
  <div class="entry-content">
    ${payload.postContent}
  </div>

  <?php if (!empty('${payload.schemaJsonLd ? "has_schema" : ""}')) : ?>
  <!-- SEO Studio Unified JSON-LD Schema -->
  <script type="application/ld+json">
    <?php echo '${(payload.schemaJsonLd || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'; ?>
  </script>
  <?php endif; ?>
</div>
`;
}

/**
 * Generates a structured import object mapped to Yoast SEO and Rank Math meta keys.
 */
export function exportToWordPressImportRecord(payload: WordPressExportPayload): WordPressImportRecord {
  return {
    post_title: payload.postTitle,
    post_name: payload.postName,
    post_content: payload.postContent,
    post_status: "publish",
    // Yoast
    _yoast_wpseo_title: payload.seoTitle,
    _yoast_wpseo_metadesc: payload.metaDescription,
    _yoast_wpseo_canonical: payload.canonicalUrl,
    _yoast_wpseo_focuskw: payload.focusKeyword,
    // Rank Math
    rank_math_title: payload.seoTitle,
    rank_math_description: payload.metaDescription,
    rank_math_canonical_url: payload.canonicalUrl,
    rank_math_focus_keyword: payload.focusKeyword
  };
}
