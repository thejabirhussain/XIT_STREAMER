const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TabStopType, TabStopPosition, UnderlineType
} = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "1A56DB", space: 4 } },
    children: [new TextRun({ text, font: "Arial", size: 32, bold: true, color: "1A56DB" })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color: "1E3A5F" })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 22, bold: true, color: "374151" })]
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 20, ...opts })]
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 20 })]
  });
}

function bulletBoldLead(lead, text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: lead, font: "Arial", size: 20, bold: true }),
      new TextRun({ text: text, font: "Arial", size: 20 })
    ]
  });
}

function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 20 })]
  });
}

function spacer(lines = 1) {
  return new Paragraph({
    spacing: { before: 0, after: lines * 120 },
    children: [new TextRun({ text: "", font: "Arial" })]
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function infoBox(title, items, color = "EFF6FF", borderColor = "1A56DB") {
  const rows = [];
  if (title) {
    rows.push(new TableRow({
      children: [new TableCell({
        borders,
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: "1A56DB", type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        children: [new Paragraph({ children: [new TextRun({ text: title, font: "Arial", size: 20, bold: true, color: "FFFFFF" })] })]
      })]
    }));
  }
  items.forEach(item => {
    rows.push(new TableRow({
      children: [new TableCell({
        borders,
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: color, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 160, right: 160 },
        children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: item, font: "Arial", size: 20 })] })]
      })]
    }));
  });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows });
}

function makeTable(headers, rows, colWidths) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders,
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: "1E3A5F", type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: h, font: "Arial", size: 18, bold: true, color: "FFFFFF" })] })]
    }))
  });
  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      borders,
      width: { size: colWidths[ci], type: WidthType.DXA },
      shading: { fill: ri % 2 === 0 ? "F8FAFF" : "FFFFFF", type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: cell, font: "Arial", size: 18 })] })]
    }))
  }));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows]
  });
}

function sectionDivider(number, title) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1200, 8160],
    rows: [new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: 1200, type: WidthType.DXA },
          shading: { fill: "1A56DB", type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 160, right: 160 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${number}`, font: "Arial", size: 36, bold: true, color: "FFFFFF" })] })]
        }),
        new TableCell({
          borders,
          width: { size: 8160, type: WidthType.DXA },
          shading: { fill: "EFF6FF", type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 200, right: 160 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: title, font: "Arial", size: 28, bold: true, color: "1E3A5F" })] })]
        })
      ]
    })]
  });
}

const doc = new Document({
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }
      ]},
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }
      ]}
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1A56DB" },
        paragraph: { spacing: { before: 480, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "1E3A5F" },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: "374151" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1A56DB", space: 6 } },
            spacing: { after: 0 },
            children: [
              new TextRun({ text: "XIT STREAMER", font: "Arial", size: 18, bold: true, color: "1A56DB" }),
              new TextRun({ text: "  |  Enterprise Creator Operations Platform — Confidential", font: "Arial", size: 16, color: "6B7280" })
            ]
          })
        ]
      })
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: "1A56DB", space: 4 } },
            tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
            spacing: { before: 80 },
            children: [
              new TextRun({ text: "Prepared by XIT Solutions  |  June 2026  |  For Internal & Leadership Use Only", font: "Arial", size: 16, color: "6B7280" }),
              new TextRun({ text: "\tPage ", font: "Arial", size: 16, color: "6B7280" }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "6B7280" })
            ]
          })
        ]
      })
    },
    children: [

      // ─── COVER PAGE ───
      spacer(4),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: "XIT STREAMER", font: "Arial", size: 72, bold: true, color: "1A56DB" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 160 },
        children: [new TextRun({ text: "Enterprise Creator Operations Platform", font: "Arial", size: 32, color: "374151" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 600 },
        children: [new TextRun({ text: "Comprehensive Product, Technical & Legal Documentation", font: "Arial", size: 24, color: "6B7280", italics: true })]
      }),
      spacer(1),
      new Table({
        width: { size: 6000, type: WidthType.DXA },
        columnWidths: [6000],
        rows: [new TableRow({ children: [new TableCell({
          borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "1A56DB" }, bottom: { style: BorderStyle.SINGLE, size: 8, color: "1A56DB" }, left: noBorder, right: noBorder },
          shading: { fill: "EFF6FF", type: ShadingType.CLEAR },
          margins: { top: 200, bottom: 200, left: 300, right: 300 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "Prepared for:", font: "Arial", size: 18, bold: true, color: "374151" })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "XIT Solutions Leadership & LYVE Studio (lyveto.com)", font: "Arial", size: 20, bold: true, color: "1A56DB" })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "Date: June 2026     |     Classification: Internal — Leadership Review", font: "Arial", size: 18, color: "6B7280" })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "Version: 1.0  |  Status: Final Draft", font: "Arial", size: 18, color: "6B7280" })] })
          ]
        })]})],
      }),
      pageBreak(),

      // ─── EXECUTIVE SUMMARY ───
      h1("Executive Summary"),
      para("XIT Streamer is an enterprise-grade Creator Operations & Live Shopping Platform that enables creators, agencies, brands, and enterprises to manage multi-platform livestreaming, interactive social commerce, and catalog-driven sales from a single unified dashboard. This documentation provides a comprehensive breakdown of the product vision, module architecture (including e-commerce and comment-to-buy features), legal landscape, technical specifications, and implementation roadmap."),
      spacer(1),
      h2("Key Findings at a Glance"),
      makeTable(
        ["Area", "Finding", "Risk Level"],
        [
          ["Legal Status", "Multi-platform simultaneous streaming is explicitly permitted by all major platforms as of 2026", "Low"],
          ["Live Selling Legalities", "Compliance with PCI DSS, consumer protection laws, and sales tax regulations required for in-stream checkouts", "Medium"],
          ["TikTok API", "No public live streaming API — requires approved partnership agreement", "High"],
          ["YouTube API", "Fully documented, publicly available Live Streaming API", "Low"],
          ["Facebook/Instagram", "Meta Live Video API available; App Review required (1–7 days)", "Low-Medium"],
          ["Data Privacy", "GDPR, CCPA, and DSA compliance required — especially for EU user data", "Medium"],
          ["Competitive Landscape", "Restream, StreamYard, OneStream operate in this space with proven models", "Medium"],
          ["MVP Timeline", "4–6 months (YouTube + Facebook + Instagram); 6–9 months with TikTok", "Manageable"],
        ],
        [2800, 4760, 1800]
      ),
      spacer(1),
      infoBox("Product Vision in One Sentence", [
        "\"Build the world's most advanced Creator Operations & Live Shopping Platform that unifies livestreaming, social commerce, audience engagement, analytics, moderation, AI assistance, and agency management into a single enterprise-grade ecosystem.\""
      ], "EFF6FF"),
      pageBreak(),

      // ─── TABLE OF CONTENTS ───
      h1("Table of Contents"),
      ...[
        ["Section 1", "Legal Landscape & Compliance"],
        ["Section 2", "Platform API Analysis"],
        ["Section 3", "Technical Architecture"],
        ["Section 4", "Product Modules (16 Modules)"],
        ["Section 5", "UI/UX Requirements & Design System"],
        ["Section 6", "Technology Stack"],
        ["Section 7", "Non-Functional Requirements"],
        ["Section 8", "Implementation Roadmap & Phases"],
        ["Section 9", "Competitive Analysis"],
        ["Section 10", "Risk Register"],
        ["Section 11", "Recommendations for Leadership"],
        ["Section 12", "Costing & Infrastructure Model"],
      ].map(([num, title]) => new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({ text: `${num}  —  ${title}`, font: "Arial", size: 20 }),
        ]
      })),
      pageBreak(),

      // ─── SECTION 1: LEGAL ───
      sectionDivider("01", "Legal Landscape & Compliance"),
      spacer(1),
      h2("1.1  Multi-Platform Simultaneous Streaming — Policy Status"),
      para("Simulcasting (broadcasting the same stream to multiple platforms simultaneously) is now explicitly permitted by all major platforms as of 2026. This represents a significant shift from earlier policies where platforms like Twitch enforced content exclusivity on affiliated creators."),
      spacer(1),
      makeTable(
        ["Platform", "Policy Status", "Exclusivity Clause", "Notes"],
        [
          ["YouTube", "Explicitly Permitted", "None", "3 concurrent broadcasts per stream key via RTMP"],
          ["Facebook", "Explicitly Permitted", "None", "Supports Pages, Profiles, Groups; crossposting allowed"],
          ["Instagram", "Explicitly Permitted", "None", "Requires Business or Creator Account; Meta App Review needed"],
          ["TikTok", "Permitted (Restricted Access)", "None", "Third-party tool access requires approved TikTok partnership"],
          ["Twitch", "Explicitly Permitted (since Oct 2023)", "Removed", "Policy changed October 2023; affiliates may now simulcast"],
          ["LinkedIn Live", "Permitted", "None", "Requires application approval for Live access"],
          ["X (Twitter)", "Permitted", "None", "Via RTMP; API access via developer program"],
        ],
        [1800, 2200, 1800, 3560]
      ),
      spacer(1),
      h2("1.2  Platform Terms of Service Analysis"),
      h3("YouTube"),
      bullet("Live Video API: Officially documented and publicly available via Google's YouTube Data API v3 and YouTube Live Streaming API"),
      bullet("Permits simultaneous broadcasts via RTMP ingestion — fully compliant"),
      bullet("Quota-based API access, not subscription-based; rate limits apply"),
      bullet("YouTube enforces Community Guidelines and handles copyright detection via the Content ID system"),
      bullet("DMCA Section 512 safe harbor applies if notice-and-takedown procedures are implemented"),
      spacer(1),
      h3("Facebook & Instagram (Meta)"),
      bullet("Live Video API: Officially documented via Meta Business Platform"),
      bullet("Explicit permission for simultaneous streaming to Facebook Pages, Profiles, and Groups"),
      bullet("App Review Required: Permissions needed include publish_video and live_video — review timeline is 1–7 days for standard requests, up to 3–4 weeks for advanced AI-related functionality"),
      bullet("Meta allows streaming simultaneously to Facebook Page and Instagram Business Account via crossposting"),
      bullet("Automatic detection of copyrighted music and nudity enforced by Meta"),
      spacer(1),
      h3("TikTok (Critical Risk Area)"),
      bullet("Official Live API: NOT PUBLICLY AVAILABLE as of June 2026"),
      bullet("TikTok restricts live streaming API access to approved partners only — tools like Restream and Streamlabs hold special partnership agreements with TikTok"),
      bullet("These partnerships can be revoked at any time without prior notice"),
      bullet("Gaming content requires 50% of recent content to be gaming-related for third-party tool eligibility"),
      bullet("Access is application-based; TikTok reviews cases individually with no guaranteed approval"),
      bullet("RECOMMENDATION: Treat TikTok as Phase 2 — negotiate partnership prior to development commitment"),
      spacer(1),
      h2("1.3  Intermediary Liability Framework"),
      para("XIT Solutions is building a distribution tool, not a content host. This distinction is legally critical and provides substantially stronger liability protection than if XIT were hosting content directly."),
      spacer(1),
      makeTable(
        ["Regulation", "Jurisdiction", "Applicability to XIT", "Required Action"],
        [
          ["Section 230", "United States", "Applies as interactive computer service / tool provider — strong protections", "Maintain ToS prohibiting illegal content"],
          ["DMCA Section 512", "United States", "Safe Harbor available — XIT does not host content but distributes it", "Designate DMCA agent; implement notice-and-takedown process"],
          ["Digital Services Act (DSA)", "European Union", "Applies if accessible in EU — classified as intermediary hosting service", "Publish transparency reports; maintain expedited notice-and-action (24hr)"],
          ["Online Safety Bill", "United Kingdom", "Applies to any platform accessible in UK", "Implement child safety measures; clear community standards; user reporting"],
          ["GDPR", "European Union", "Applies to all EU resident data processed via platform", "DPA, consent mechanisms, data deletion workflows within 30 days"],
          ["CCPA", "California, USA", "Applies if serving California residents", "Privacy policy disclosures; opt-out rights; data sale restrictions"],
        ],
        [2200, 1600, 3200, 2360]
      ),
      spacer(1),
      h2("1.4  Data Privacy & GDPR Compliance"),
      h3("Data Categories Collected"),
      bullet("Creator OAuth tokens for each connected platform (sensitive — requires AES-256 encryption at rest)"),
      bullet("Real-time chat data: usernames, message content, timestamps, platform metadata"),
      bullet("Stream metadata: start time, duration, viewer count, engagement metrics"),
      bullet("Creator analytics and performance data"),
      bullet("Billing and subscription data (PCI DSS considerations apply)"),
      spacer(1),
      h3("GDPR Obligations"),
      makeTable(
        ["Obligation", "Requirement", "Implementation"],
        [
          ["Lawful Basis", "Contractual necessity for OAuth tokens; Legitimate interest for analytics", "Document lawful basis per processing activity in ROPA"],
          ["Right to Access", "User can request all data held", "Build data export functionality within 30-day SLA"],
          ["Right to Deletion", "Delete all personal data within 30 days of request", "Implement account deletion cascade across all services"],
          ["Data Portability", "Standard format data export", "JSON/CSV export for all user analytics and stream data"],
          ["DPIA", "Required before launch for high-risk processing", "Conduct before production deployment; document outcomes"],
          ["DPA Agreement", "Required with all sub-processors (AWS, etc.)", "Execute DPAs with all third-party vendors before launch"],
        ],
        [2400, 3200, 3760]
      ),
      h2("1.5  Live Selling & Transactional Compliance"),
      para("When facilitating direct commercial transactions via livestreaming (social commerce / comment-to-buy), XIT Streamer enters the domain of transactional compliance. XIT Streamer acts as a facilitator, meaning compliance requirements are split between XIT Streamer and the integrated e-commerce merchants."),
      spacer(1),
      makeTable(
        ["Regulatory Area", "Applicability", "Platform Implementation / Action"],
        [
          ["PCI-DSS Compliance", "Applies to any payment card processing or storage", "All payment processing is delegated to PCI-DSS Level 1 compliant gateways (Stripe, PayPal, Shopify Pay). XIT Streamer never stores raw card data."],
          ["Sales Tax Automation", "Applies to sales tax calculation across multiple jurisdictions (nexus laws)", "Integrations with tax engines (Avalara, TaxJar) or direct delegation to the merchant's e-commerce platform (e.g., Shopify's tax engine) to automatically calculate local taxes based on shipping addresses."],
          ["Consumer Protection (FTC/EU)", "Applies to advertising transparency, returns, refunds, and delivery timelines", "ToS must require merchants to state return/refund policies clearly. Built-in templates for order confirmations must include direct merchant contact info and refund options."],
          ["Chargeback & Fraud Liability", "Applies to fraudulent transactions and purchase disputes", "XIT Streamer acts as an integration mediator. Liability rests with the merchant account. XIT provides comprehensive chat logs and action audits to assist in chargeback disputes."]
        ],
        [2400, 3200, 3760]
      ),
      spacer(1),
      infoBox("Legal Action Items Before Launch", [
        "1.  Draft Terms of Service explicitly assigning content compliance responsibility to creators",
        "2.  Publish Privacy Policy covering GDPR, CCPA, and DSA requirements",
        "3.  Execute Data Processing Agreements with all sub-processors (AWS, Kafka vendors, etc.)",
        "4.  Conduct Data Protection Impact Assessment (DPIA) before production deployment",
        "5.  Designate a DMCA Agent and register with US Copyright Office",
        "6.  Implement automated copyright flagging at stream ingestion point (copyrighted music detection)",
        "7.  Establish audit log retention policy for all stream configurations and moderation actions",
        "8.  Negotiate TikTok partnership agreement before committing engineering resources to TikTok integration",
        "9.  Secure PCI-DSS Level 1 certification or delegate completely to a certified payment provider (Stripe/PayPal)",
        "10. Implement multi-state and international sales tax automation compliance workflows (via Avalara/TaxJar integrations)",
        "11. Draft merchant Terms of Service covering returns, chargebacks, and shipping SLAs for live-purchased items",
      ], "FFF7ED"),
      pageBreak(),

      // ─── SECTION 2: PLATFORM API ───
      sectionDivider("02", "Platform API Analysis"),
      spacer(1),
      h2("2.1  YouTube Live Streaming API"),
      makeTable(
        ["Capability", "Status", "Notes"],
        [
          ["API Availability", "Public — Fully Documented", "YouTube Data API v3 + Live Streaming API"],
          ["Authentication", "OAuth 2.0", "Google Sign-In; scopes: youtube.force-ssl"],
          ["Live Broadcast Creation", "Available", "liveBroadcasts.insert endpoint"],
          ["Stream Ingestion", "RTMP", "liveStreams.insert provides stream key + RTMP URL"],
          ["Chat/Comments API", "Available", "liveChatMessages.list — polling-based, not WebSocket"],
          ["Analytics API", "Available", "YouTube Analytics & Reporting API"],
          ["Rate Limits", "Quota-based", "10,000 units/day default; higher quota via Google application"],
          ["App Review", "Required", "Standard OAuth consent screen review"],
        ],
        [2800, 2200, 4360]
      ),
      spacer(1),
      h2("2.2  Meta (Facebook + Instagram) Live API"),
      makeTable(
        ["Capability", "Status", "Notes"],
        [
          ["API Availability", "Public — Documented", "Meta Business Platform Graph API"],
          ["Facebook Live", "Available", "POST /{page-id}/live_videos; RTMP ingest"],
          ["Instagram Live", "Available", "POST /ig_user/live_media via Instagram Business API"],
          ["Chat/Comments API", "Available (Polling)", "GET /{live-video-id}/comments — polling required"],
          ["Cross-posting", "Available", "Simultaneous Facebook Page + Instagram broadcast"],
          ["Webhooks", "Available", "Real-time comment/reaction notifications"],
          ["App Review", "Required", "publish_video, live_video permissions; 1–7 days standard"],
          ["Rate Limits", "Per-call limits", "Varies by endpoint; header-based rate limit feedback"],
        ],
        [2800, 2200, 4360]
      ),
      spacer(1),
      h2("2.3  TikTok Live API — Critical Assessment"),
      infoBox("IMPORTANT: TikTok API Limitation", [
        "TikTok does not offer a public API for live streaming as of June 2026.",
        "Live broadcasting via third-party tools is only available through approved TikTok Partner agreements.",
        "These partnerships are application-based, not guaranteed, and can be revoked without notice.",
        "Existing tools (Restream, Streamlabs) hold legacy partner agreements that are not transferable.",
        "RECOMMENDATION: Begin TikTok partnership application immediately; do not block MVP launch on TikTok.",
      ], "FFF1F0"),
      spacer(1),
      makeTable(
        ["TikTok API Area", "Status", "Path Forward"],
        [
          ["Live Streaming API", "Not Publicly Available", "Apply for TikTok Partner API access"],
          ["Comments/Chat API", "Restricted — Partner Only", "Included in partner agreement scope"],
          ["Analytics API", "Available for Business Accounts", "Use TikTok Business API for post-stream analytics"],
          ["Authentication", "OAuth 2.0 (restricted scope)", "Available via TikTok for Developers portal"],
          ["Video Upload API", "Available", "Can be used for VOD upload post-stream"],
        ],
        [2800, 2400, 4160]
      ),
      spacer(1),
      h2("2.4  E-commerce & Chat Commerce Integration APIs"),
      para("To support seamless comment-to-buy transactions and automated catalog synchronization, XIT Streamer interfaces with major e-commerce platforms and platform-specific messaging APIs:"),
      spacer(1),
      makeTable(
        ["API Domain", "Integration Endpoint", "Purpose & Application"],
        [
          ["Shopify GraphQL API", "/api/2026-04/graphql.json", "Imports product listings, checks real-time inventory levels, creates draft orders, and triggers checkout URLs when a customer comments a purchase code."],
          ["WooCommerce REST API", "/wp-json/wc/v3/products", "Synchronizes product descriptions, SKU references, prices, and stock counts between the seller's WordPress-based catalog and XIT Streamer."],
          ["Meta Messenger API", "Graph API /me/messages", "Sends automated purchase links and shopping cart recovery flows via Facebook Messenger when a purchase comment is detected on a live stream."],
          ["Instagram Direct API", "Graph API /me/messages (IG scope)", "Sends direct messages (DMs) containing custom checkout or cart links to Instagram users who comment buying keywords on Instagram Live streams."],
          ["Stripe payment API", "v1/checkout/sessions", "Generates secure checkout sessions and monitors webhook events for transaction completion to notify the fulfillment flow."]
        ],
        [2400, 2800, 4160]
      ),
      pageBreak(),

      // ─── SECTION 3: TECHNICAL ARCHITECTURE ───
      sectionDivider("03", "Technical Architecture"),
      spacer(1),
      h2("3.1  System Architecture Overview"),
      para("XIT Streamer is designed as a microservices architecture with clear separation of concerns across eight core domains: Authentication, Stream Orchestration, Chat Aggregation, Commerce Sync, Order Orchestration, Analytics, Moderation, and Agency Management."),
      spacer(1),
      h3("Architecture Layers"),
      makeTable(
        ["Layer", "Components", "Technology"],
        [
          ["Presentation Layer", "Creator Dashboard, Shoppable Web Player, E-commerce Overlays, Agency Portal, Admin Panel, Mobile App", "Next.js, React, TypeScript, TailwindCSS, ShadCN UI, Framer Motion"],
          ["API Gateway", "Request routing, rate limiting, auth middleware, load balancing", "NestJS API Gateway, Kong or AWS API Gateway"],
          ["Application Services", "Auth Service, Stream Service, Chat Service, Commerce Service, Order Dispatcher, Analytics Service, Moderation Service, AI Copilot", "NestJS Microservices, Node.js, TypeScript"],
          ["Stream Orchestration", "RTMP ingest, multi-platform broadcast, stream health monitoring", "FFmpeg / SRS / Wowza, custom Node.js orchestrator"],
          ["Real-Time Messaging", "Chat aggregation, WebSocket management, event streaming", "Redis Streams, Apache Kafka, Socket.io"],
          ["Data Persistence", "User data, stream metadata, product cache, analytics, audit logs", "PostgreSQL, Redis (cache), MongoDB (unstructured analytics)"],
          ["Infrastructure", "Container orchestration, service mesh, monitoring", "Docker, Kubernetes (AWS EKS), Prometheus, Grafana"],
          ["Storage", "Stream recordings, thumbnails, reports, exports", "AWS S3, CloudFront CDN"],
        ],
        [2200, 3400, 3760]
      ),
      spacer(1),
      h2("3.2  Multi-Platform Stream Orchestration Engine"),
      h3("How Simultaneous Streaming Works"),
      para("When a creator clicks 'Go Live' on XIT Streamer, the following sequence occurs:"),
      numbered("Creator's encoder (OBS, XSplit, or browser-based) sends a single RTMP stream to XIT Streamer's ingest server"),
      numbered("The Stream Orchestration Engine receives the RTMP stream and duplicates it"),
      numbered("Parallel RTMP push workers forward the stream simultaneously to each selected platform's ingest URL"),
      numbered("Each platform receives its own stream key and connection, independent of others"),
      numbered("Health monitors continuously track FPS, bitrate, packet loss, and connection status per platform"),
      numbered("Automatic reconnection and failover logic handles individual platform disruptions without affecting others"),
      spacer(1),
      makeTable(
        ["Component", "Responsibility", "Technology"],
        [
          ["RTMP Ingest Server", "Receives stream from creator's encoder", "SRS (Simple RTMP Server) or Nginx-RTMP"],
          ["Stream Duplicator", "Creates parallel copies of the incoming stream", "FFmpeg with multiple RTMP outputs"],
          ["Platform Push Workers", "Maintains dedicated connections to each platform's RTMP endpoint", "Node.js worker threads, one per platform"],
          ["Health Monitor", "Tracks stream vitals: FPS, bitrate, resolution, packet loss", "Custom metrics collection + Prometheus"],
          ["Auto-Recovery", "Detects failures and reconnects within 3 seconds", "Circuit breaker pattern, exponential backoff"],
          ["Stream Session DB", "Tracks all active stream sessions, keys, endpoints", "PostgreSQL with Redis cache"],
        ],
        [2400, 3400, 3560]
      ),
      spacer(1),
      h2("3.3  Unified Chat Aggregation Engine"),
      para("The chat aggregation engine is one of the most technically complex components of XIT Streamer. It must collect comments from multiple platforms in near real-time, normalize them into a unified format, and deliver them to the creator's dashboard with sub-200ms latency."),
      spacer(1),
      h3("Chat Data Flow"),
      numbered("Platform adapters poll or receive webhook events from YouTube, Facebook, Instagram, TikTok chat APIs"),
      numbered("Raw messages are pushed to Apache Kafka topic partitioned by platform"),
      numbered("Chat normalization service consumes from Kafka, applies unified message schema, tags platform source"),
      numbered("Normalized messages are written to Redis Streams for real-time delivery"),
      numbered("WebSocket server pushes messages to connected creator dashboard clients"),
      numbered("Messages are also persisted to PostgreSQL for search, moderation history, and analytics"),
      spacer(1),
      makeTable(
        ["Platform", "Data Collection Method", "Latency", "Limitation"],
        [
          ["YouTube", "Polling: liveChatMessages.list (500ms interval)", "500–1000ms", "Quota consumption; polling interval constraints"],
          ["Facebook", "Webhooks (real-time) + Polling fallback", "100–300ms", "Webhook setup requires app review approval"],
          ["Instagram", "Polling via Graph API (1s interval)", "1000–2000ms", "Slower API; fewer real-time options"],
          ["TikTok", "Partner API WebSocket (when available)", "100–500ms", "Requires TikTok partner agreement"],
        ],
        [1800, 3200, 1800, 2560]
      ),
      spacer(1),
      h2("3.4  Authentication & Security Architecture"),
      h3("OAuth Token Management"),
      bullet("All platform OAuth tokens encrypted using AES-256 at rest in PostgreSQL"),
      bullet("Token refresh handled automatically before expiry — users never interrupted by re-auth prompts during live streams"),
      bullet("Token health dashboard shows status of all connected platform credentials"),
      bullet("Platform disconnection events logged and creator notified via push notification"),
      spacer(1),
      h3("Security Measures"),
      makeTable(
        ["Security Layer", "Implementation"],
        [
          ["Transport Security", "TLS 1.3 for all API traffic; RTMP over TLS (RTMPS) for stream ingestion"],
          ["Data Encryption", "AES-256 for OAuth tokens and sensitive data at rest"],
          ["Authentication", "JWT with short expiry (15 min access tokens, 7-day refresh tokens); MFA via TOTP"],
          ["Authorization", "Role-Based Access Control (RBAC) with 7 permission levels"],
          ["API Security", "Rate limiting, IP allowlisting for enterprise, API key rotation"],
          ["Session Management", "Automatic session invalidation on suspicious activity; concurrent session limits"],
          ["Audit Logging", "All user actions, stream events, and moderation decisions logged with timestamps"],
        ],
        [3200, 6160]
      ),
      spacer(1),
      h2("3.5  Live Commerce & Checkout Architecture"),
      para("The commerce architecture manages real-time catalog mapping, chat purchasing flows, automated DM dispatch, and transaction notifications:"),
      spacer(1),
      h3("Comment-to-Buy and Automated Checkout Flow"),
      numbered("Creator tags a product from their synced catalog (e.g., product code '#123') and starts the stream"),
      numbered("XIT Streamer automatically projects product details (name, price, stock) via the Overlay Graphics Engine"),
      numbered("Viewers comment '#123' or 'buy #123' on the streaming platforms (Facebook, Instagram, YouTube)"),
      numbered("The Unified Chat Aggregator consumes the comment and identifies purchase intent using regex keyword matching"),
      numbered("The Order Orchestration Service checks product inventory status with the connected Shopify store"),
      numbered("If stock is available, a draft order is created in the Shopify store, reserving the item for 15 minutes"),
      numbered("The Commerce Service calls Meta's Graph API or Instagram Direct API to send a DM containing a secure checkout link directly to the viewer"),
      numbered("The viewer clicks the link in their DM, lands on the secure Shopify checkout page pre-filled with the item, completes the transaction, and the checkout webhook triggers an in-stream purchase notification"),
      spacer(1),
      makeTable(
        ["Sub-service", "Function", "Technology"],
        [
          ["Catalog Sync Worker", "Runs cron jobs to synchronize inventory and SKU updates", "NestJS scheduler, Shopify Admin API Client"],
          ["Intent Detection Parser", "Parses real-time message feeds via regular expression models", "Fast Node.js stream processors"],
          ["Order Orchestrator", "Dispatches draft orders and locks inventory temporarily", "Redis-based distributed locks (Redlock)"],
          ["DM Dispatcher", "Dispatches private links via Facebook Messenger / Instagram API", "BullMQ queue, Meta Graph API client"],
          ["Webhook Listener", "Receives payment notifications and triggers overlay events", "Express.js endpoint, signature verification"],
        ],
        [2400, 3400, 3560]
      ),
      pageBreak(),

      // ─── SECTION 4: MODULES ───
      sectionDivider("04", "Product Modules — All 16 Modules"),
      spacer(1),
      para("XIT Streamer is structured into 16 core modules. Each module is independently deployable as a microservice while sharing a unified data layer and API gateway."),
      spacer(1),

      h2("Module 1: Authentication System"),
      makeTable(
        ["Feature", "Description"],
        [
          ["User Registration & Login", "Email/password registration with email verification; social login via Google and Meta OAuth"],
          ["Multi-Factor Authentication", "TOTP-based MFA (Google Authenticator, Authy); SMS fallback via Twilio"],
          ["Password Reset", "Secure token-based password reset with 15-minute expiry"],
          ["Session Management", "JWT access tokens (15 min) + refresh tokens (7 days); automatic renewal"],
          ["Role-Based Access Control", "7 roles: Super Admin, Admin, Agency Owner, Creator Manager, Creator, Moderator, Viewer"],
          ["Team Invitations", "Email-based workspace invitations with role assignment; expiry after 72 hours"],
          ["Workspace Management", "Multi-tenant architecture; creators can belong to multiple workspaces"],
          ["SSO Support", "SAML 2.0 / OIDC SSO for enterprise organizations (Phase 2)"],
        ],
        [2800, 6560]
      ),
      spacer(1),

      h2("Module 2: Platform Connection Center"),
      makeTable(
        ["Platform", "Connection Type", "Features"],
        [
          ["YouTube", "OAuth 2.0 (Google)", "Channel selection, stream key management, quota monitoring"],
          ["Facebook", "OAuth 2.0 (Meta)", "Page selection, group streaming, token health tracking"],
          ["Instagram", "OAuth 2.0 (Meta)", "Business/Creator account connection, linked to Facebook app"],
          ["TikTok", "OAuth 2.0 (TikTok — Partner)", "Account verification, live eligibility check, partner token"],
        ],
        [2000, 2400, 4960]
      ),
      spacer(1),
      para("Connected Accounts Dashboard shows for each account: profile image, platform name, connection status (Connected / Expired / Error), last sync timestamp, token health indicator, and action buttons (Refresh, Reauthorize, Disconnect)."),
      spacer(1),

      h2("Module 3: Stream Creation Studio"),
      para("The Stream Creation Studio is the primary workflow interface for creators. It provides a step-by-step stream setup experience."),
      h3("Stream Configuration Fields"),
      bullet("Stream title, description, category, and tags"),
      bullet("Thumbnail upload (drag-and-drop with live preview)"),
      bullet("Scheduled date and time with timezone support"),
      bullet("Visibility settings per platform (Public, Unlisted, Private)"),
      bullet("Platform selection with per-platform toggle and settings override"),
      spacer(1),
      h3("Advanced Settings per Platform"),
      makeTable(
        ["Setting", "YouTube", "Facebook", "Instagram", "TikTok"],
        [
          ["DVR / Rewind", "Yes", "Yes", "No", "No"],
          ["Auto-Recording", "Yes", "Yes", "No", "No"],
          ["Latency Mode", "Low / Ultra-Low", "Low", "Standard", "Standard"],
          ["Stream Quality", "1080p/720p/480p", "1080p/720p", "720p max", "1080p"],
          ["Auto-Start", "Yes (scheduled)", "Yes (scheduled)", "No", "No"],
        ],
        [2400, 1740, 1740, 1740, 1740]
      ),
      spacer(1),

      h2("Module 4: Multi-Platform Stream Orchestrator"),
      para("Backend engine responsible for creating platform broadcasts, generating stream sessions, managing RTMP endpoints, monitoring health, and handling failures. See Section 3.2 for detailed technical breakdown."),
      h3("Real-Time Monitoring Dashboard"),
      makeTable(
        ["Metric", "Display", "Alert Threshold"],
        [
          ["FPS", "Live gauge per platform", "< 24 FPS triggers warning"],
          ["Resolution", "Current encoding resolution", "Drops below target triggers warning"],
          ["Bitrate", "kbps chart over time", "< 50% of target triggers alert"],
          ["Packet Loss", "Percentage gauge", "> 2% triggers alert; > 5% triggers auto-recovery"],
          ["Audio Status", "Level meter", "Silence > 10 seconds triggers warning"],
          ["Encoder Health", "CPU/GPU usage indicators", "> 85% CPU usage triggers warning"],
        ],
        [2400, 3200, 3760]
      ),
      spacer(1),

      h2("Module 5: Unified Chat Aggregator"),
      para("One of the most differentiated features of XIT Streamer. A single real-time chat feed aggregating messages from all streaming platforms simultaneously."),
      h3("Unified Message Format"),
      makeTable(
        ["Field", "Description"],
        [
          ["Avatar", "Platform-fetched user profile image with fallback initials"],
          ["Username", "Platform username with direct link to user profile"],
          ["Platform Badge", "Color-coded icon: YouTube (red), Facebook (blue), Instagram (gradient), TikTok (black)"],
          ["Message Content", "Full message text with emoji support and hyperlink parsing"],
          ["Timestamp", "Relative time (e.g., '2 min ago') with hover for exact time"],
          ["Moderator Tools", "Right-click context menu: Pin, Highlight, Delete, Timeout, Ban"],
        ],
        [2400, 6960]
      ),
      spacer(1),
      h3("Performance Target: Sub-200ms message delivery for YouTube and Facebook; 500–1000ms for Instagram"),
      spacer(1),

      h2("Module 6: Moderation Command Center"),
      h3("Manual Moderation Tools"),
      bullet("Delete individual messages across any platform from unified interface"),
      bullet("Timeout users: configurable duration (1 min, 5 min, 10 min, 1 hour, permanent)"),
      bullet("Ban users: platform-specific or XIT-platform-wide ban list"),
      bullet("Keyword filtering: blocklist with regex support and automatic deletion"),
      bullet("Spam filtering: rate-limiting on messages from single user (configurable threshold)"),
      bullet("Link blocking: prevent URL sharing with allowlist for trusted domains"),
      spacer(1),
      h3("AI-Powered Moderation Features"),
      makeTable(
        ["AI Feature", "Description", "Model"],
        [
          ["Toxicity Detection", "Scores messages 0–1 for harmful content; auto-removes above threshold", "Google Perspective API or custom fine-tuned model"],
          ["Hate Speech Detection", "Detects hate speech targeting protected groups", "Integrated with moderation pipeline"],
          ["Harassment Detection", "Identifies targeted harassment patterns across multiple messages", "Contextual analysis model"],
          ["Sentiment Analysis", "Real-time audience mood tracker shown on analytics bar", "Hugging Face sentiment model"],
          ["GPT Moderation Assistant", "AI suggests moderation actions with explanations (Phase 2)", "Claude API / GPT-4 integration"],
        ],
        [2600, 3800, 2960]
      ),
      spacer(1),

      h2("Module 7: Analytics Intelligence Center"),
      h3("Real-Time Metrics"),
      makeTable(
        ["Metric", "Update Frequency", "Visualization"],
        [
          ["Current Viewers", "Every 30 seconds", "Live counter with trend arrow"],
          ["Peak Viewers", "Updated at each check", "Running maximum displayed prominently"],
          ["Watch Time", "Per-minute accumulation", "Total hours gauge"],
          ["Engagement Rate", "Per-minute calculation", "Percentage with benchmark comparison"],
          ["New Followers / Subscribers", "Real-time via webhook", "Running counter with platform breakdown"],
          ["Chat Velocity", "Messages per minute", "Sparkline chart (last 30 minutes)"],
        ],
        [2800, 2600, 3960]
      ),
      spacer(1),
      h3("Historical Analytics"),
      bullet("Daily, weekly, monthly, and quarterly performance views"),
      bullet("Platform comparison charts — identify which platform drives most engagement"),
      bullet("Audience retention graphs — track viewer drop-off over stream duration"),
      bullet("Heatmaps — identify peak engagement moments within streams"),
      bullet("Creator performance reports for agency clients"),
      bullet("Campaign reports linking streaming performance to business outcomes"),
      spacer(1),

      h2("Module 8: AI Copilot"),
      para("An AI-powered assistant embedded in the creator's live stream experience, powered by Claude or GPT-4 APIs."),
      h3("During Live Streams"),
      makeTable(
        ["Feature", "Description"],
        [
          ["Reply Suggestions", "Reads top chat questions, generates 3 suggested replies for creator to pick from"],
          ["Audience Question Detection", "Identifies questions in chat stream, surfaces most relevant ones"],
          ["Sentiment Monitor", "Live sentiment bar showing audience mood throughout stream"],
          ["Engagement Ideas", "Proactive suggestions: 'Your chat is slowing — consider running a poll'"],
        ],
        [2800, 6560]
      ),
      spacer(1),
      h3("Post-Stream AI Generation"),
      bullet("Automatic stream summary: key moments, peak engagement times, top comments"),
      bullet("Clip suggestions: identifies best moments for short-form content"),
      bullet("Title and description generation for VOD re-uploads"),
      bullet("Social media post drafts for Twitter/X, LinkedIn, Instagram"),
      bullet("Newsletter content based on stream topics"),
      spacer(1),

      h2("Module 9: Agency Management Suite"),
      para("Enterprise-focused module enabling talent agencies and brand management companies to manage multiple creators from a single workspace."),
      h3("Agency Dashboard Capabilities"),
      bullet("Manage multiple creator profiles under one agency workspace"),
      bullet("Assign creators to specific team members (Creator Managers)"),
      bullet("Per-creator permission control — what each manager can see and do"),
      bullet("Cross-creator analytics comparison — identify top performers"),
      bullet("White-label report generation for client presentations"),
      bullet("Revenue tracking integration (Phase 2 — Stripe integration for billing attribution)"),
      bullet("Campaign tracking: link streams to specific brand campaigns and measure ROI"),
      spacer(1),

      h2("Module 10: Notification System"),
      makeTable(
        ["Trigger Event", "Notification Channels"],
        [
          ["Stream Started Successfully", "Email, Push, Slack, Microsoft Teams"],
          ["Stream Ended", "Email, Push"],
          ["Platform Connection Lost", "Email, Push, SMS, Slack"],
          ["Chat Spike Detected", "Push, Slack"],
          ["New Follower Milestone", "Push, Email"],
          ["Moderation Alert (toxicity detected)", "Push, Slack"],
          ["Token Expiry Warning (48 hours)", "Email, Push"],
          ["Scheduled Stream Reminder (15 min)", "Push, SMS"],
        ],
        [3200, 6160]
      ),
      spacer(1),

      h2("Module 11: Reporting Center"),
      h3("Report Types"),
      bullet("PDF Reports: Executive-ready formatted reports with branding and charts"),
      bullet("CSV Exports: Raw data exports for every analytics dimension"),
      bullet("Agency Client Reports: White-labeled performance summaries per creator"),
      bullet("Sponsor Reports: Campaign performance metrics suitable for brand presentations"),
      spacer(1),
      h3("Automated Scheduling"),
      bullet("Daily digests: stream-by-stream performance sent at 9 AM local time"),
      bullet("Weekly summaries: top content, follower growth, engagement trends"),
      bullet("Monthly executive reports: platform overview with period-over-period comparison"),
      spacer(1),

      h2("Module 12: Admin Control Panel"),
      makeTable(
        ["Admin Function", "Capability"],
        [
          ["User Management", "View, edit, suspend, delete any user; override permissions; impersonate for support"],
          ["Subscription Management", "Upgrade, downgrade, cancel; apply promo codes; view billing history"],
          ["Platform Monitoring", "Real-time view of all active streams across all users"],
          ["Incident Management", "Flag and investigate reported content; platform-wide moderation actions"],
          ["System Analytics", "Total users, active streams, connected accounts, API quota usage, revenue"],
          ["System Health", "Service status, Kafka lag, Redis memory, DB connections, API response times"],
        ],
        [2800, 6560]
      ),
      spacer(1),

      h2("Module 13: Live Shopping & E-commerce Sync"),
      makeTable(
        ["Feature", "Description"],
        [
          ["Multi-Platform Catalog Import", "Sync product databases from Shopify, WooCommerce, or custom API endpoints in real-time."],
          ["Product Spotlight Manager", "Pin selected products, change promotional offers dynamically during a livestream, and show inventory alert thresholds."],
          ["Real-Time Inventory Lock", "Instantly reserve stock items for customers in draft carts to prevent overselling of high-demand items during live sessions."],
          ["Dynamic Pricing Engine", "Apply live-only coupon codes, flash discounts, or group purchase discount rules that expire when the stream ends."],
        ],
        [2800, 6560]
      ),
      spacer(1),

      h2("Module 14: Comment-to-Buy & Chat Commerce"),
      makeTable(
        ["Feature", "Description"],
        [
          ["Automated Intent Parser", "Aggregated comment streams are scanned for pattern codes (e.g. 'buy #401', 'want #red-large') in real-time."],
          ["Direct Message Link Dispatcher", "Triggers automated, customized purchase/checkout link delivery via Facebook Messenger and Instagram DM immediately after comment recognition."],
          ["Abandoned Cart Recovery", "Sends automated reminders to users who initiated purchase intent via comments but did not complete checkout within a configurable time (e.g., 30 minutes)."],
          ["E-commerce Customer Matching", "Correlates social profiles with existing customer databases to automatically populate delivery addresses and historical preferences."],
        ],
        [2800, 6560]
      ),
      spacer(1),

      h2("Module 15: Shoppable Web Player & Widgets"),
      makeTable(
        ["Feature", "Description"],
        [
          ["Interactive HTML5 Web Player", "Embeddable player for client websites that includes a slide-out shopping cart, live Q&A, and direct product checkout."],
          ["In-Player Checkout Flow", "Enables viewers to select sizes, update quantities, and complete Stripe/Shopify Pay transactions without leaving the video frame."],
          ["Simultaneous Multi-stream Cart", "Maintains cart persistence for the viewer across social platforms and the brand's own storefront website."],
          ["Picture-in-Picture Cart", "Minimizes the video stream into a corner PIP window so viewers can continue watching while typing payment details on the main page."],
        ],
        [2800, 6560]
      ),
      spacer(1),

      h2("Module 16: Interactive Overlays & Graphics Engine"),
      makeTable(
        ["Feature", "Description"],
        [
          ["Dynamic Product Card Overlay", "Renders customized graphical overlays with product images, pricing, and live inventory progress bars onto the video feed."],
          ["Live Purchase Feed", "Visual notifications (e.g. 'Sarah just bought the Summer Hoodie!') overlayed dynamically on stream to leverage social proof."],
          ["Gamification Widgets", "Interactive widgets like spin-to-win discount wheels, live bidding auctions, and countdown timers overlayed on the video canvas."],
          ["Custom Brand Themes", "CSS-themed graphic layouts to match merchant branding, configured via drag-and-drop templates in the creator studio."],
        ],
        [2800, 6560]
      ),
      pageBreak(),

      // ─── SECTION 5: UI/UX ───
      sectionDivider("05", "UI/UX Requirements & Design System"),
      spacer(1),
      h2("5.1  Design Philosophy"),
      para("XIT Streamer should feel like a premium enterprise tool. The design should draw inspiration from the following reference products: Linear (clean dark mode, fast interactions), Notion (flexible workspace feel), Stripe Dashboard (data clarity and trust), Vercel (developer-grade polish), Datadog (dense information architecture done right), and Slack (collaborative workspace feel)."),
      spacer(1),
      h2("5.2  Design Principles"),
      makeTable(
        ["Principle", "Application"],
        [
          ["Modern & Enterprise-Grade", "No consumer-app aesthetics; every element communicates trust, scale, and professionalism"],
          ["Minimal & Clean", "Information hierarchy over decoration; whitespace is structural, not empty"],
          ["Fast & Responsive", "Page load < 2 seconds; all interactions respond in < 100ms; optimistic UI updates"],
          ["Dark Mode First", "Dark mode is default; light mode fully supported; system preference detection"],
          ["Density-Appropriate", "Creator dashboard: dense and information-rich. Onboarding: spacious and guided"],
          ["Mobile Responsive", "Full feature parity on mobile (380px+); tablet optimized; desktop maximized"],
          ["Non-Distracting Animations", "Framer Motion micro-interactions only; no decorative animations during live streams"],
        ],
        [2800, 6560]
      ),
      spacer(1),
      h2("5.3  Responsive Breakpoints"),
      makeTable(
        ["Breakpoint", "Width", "Layout"],
        [
          ["Mobile", "380px – 767px", "Single column; bottom navigation; collapsed sidebar"],
          ["Tablet", "768px – 1199px", "Two-column; icon sidebar; collapsed panels"],
          ["Desktop", "1200px – 1439px", "Full three-column layout; expanded sidebar"],
          ["Wide Desktop", "1440px+", "Maximum content width 1440px; side padding increases"],
        ],
        [2000, 2800, 4560]
      ),
      pageBreak(),

      // ─── SECTION 6: TECH STACK ───
      sectionDivider("06", "Technology Stack"),
      spacer(1),
      makeTable(
        ["Category", "Technology", "Justification"],
        [
          ["Frontend Framework", "Next.js 14 + React 18 + TypeScript", "SSR/SSG capabilities; App Router; TypeScript for enterprise-grade type safety"],
          ["Styling", "TailwindCSS + ShadCN UI", "Utility-first CSS; pre-built accessible components; consistent design tokens"],
          ["Animations", "Framer Motion", "Production-grade animation library; GPU-accelerated; React-native"],
          ["Backend Framework", "NestJS (Node.js + TypeScript)", "Modular microservices; built-in DI; TypeScript throughout; enterprise patterns"],
          ["Primary Database", "PostgreSQL 15", "ACID compliance; JSON support; enterprise scalability; RLS for multi-tenancy"],
          ["Cache / Real-Time", "Redis 7 (Redis Streams)", "Sub-millisecond reads; Pub/Sub; chat message buffering; session storage"],
          ["Message Broker", "Apache Kafka", "High-throughput chat aggregation; guaranteed delivery; replay capability"],
          ["Stream Server", "SRS (Simple RTMP Server)", "Open-source; high-performance RTMP ingest; low latency"],
          ["Stream Processing", "FFmpeg", "Battle-tested multi-platform stream encoding and forwarding"],
          ["Object Storage", "AWS S3 + CloudFront", "Stream recordings, thumbnails, exports; global CDN distribution"],
          ["Authentication", "OAuth 2.0 + JWT + Passport.js", "Industry standard; multi-provider; extensible"],
          ["Containerization", "Docker + Kubernetes (AWS EKS)", "Horizontal scaling; service isolation; zero-downtime deployments"],
          ["Monitoring", "Prometheus + Grafana + CloudWatch", "Real-time metrics; alerting; AWS-native monitoring"],
          ["Email Service", "AWS SES / SendGrid", "Transactional email; high deliverability"],
          ["SMS Notifications", "Twilio", "Global SMS delivery; MFA support"],
          ["AI Integration", "Anthropic Claude API / OpenAI API", "AI Copilot features; moderation assistance; content generation"],
          ["E-Commerce Integration", "Shopify Admin API & WooCommerce REST API", "Bi-directional syncing of products, SKUs, inventory, and creation of draft orders."],
          ["Payment Gateways", "Stripe SDK & Shopify Pay", "Delegated PCI-compliant checkout sessions, payment processing, and transaction webhooks."],
        ],
        [2200, 2800, 4360]
      ),
      pageBreak(),

      // ─── SECTION 7: NON-FUNCTIONAL ───
      sectionDivider("07", "Non-Functional Requirements"),
      spacer(1),
      makeTable(
        ["Category", "Requirement", "Target"],
        [
          ["Performance", "Page load time", "< 2 seconds (P95)"],
          ["Performance", "Chat message delivery latency", "< 200ms (YouTube/Facebook); < 1000ms (Instagram)"],
          ["Performance", "API response time", "< 500ms (P95)"],
          ["Performance", "Stream start latency (Go Live to platform)", "< 5 seconds"],
          ["Availability", "Platform uptime", "99.9% SLA (< 8.76 hours downtime/year)"],
          ["Availability", "Stream orchestration uptime", "99.95% (critical path — higher SLA)"],
          ["Scalability", "Concurrent creators", "10,000+ simultaneous active creators"],
          ["Scalability", "Chat messages per day", "10 million+ messages/day across all creators"],
          ["Scalability", "Horizontal scaling", "Auto-scaling Kubernetes pods under load"],
          ["Security", "Data transport", "TLS 1.3 minimum for all API and RTMP traffic"],
          ["Security", "Data at rest", "AES-256 encryption for all sensitive data"],
          ["Security", "Authentication", "MFA available; JWT with short expiry; brute-force protection"],
          ["Compliance", "GDPR", "EU data residency option; Data subject rights workflows (access/deletion) within 30 days"],
          ["Compliance", "CCPA", "Opt-out mechanisms; Privacy Policy disclosures; standard data sales exclusion"],
          ["Compliance", "DSA", "Notice-and-action mechanisms; annual transparency report; content appeal options"],
          ["Performance", "Comment-to-Buy link delivery", "< 1.5 seconds (P95) from comment detection to DM sent"],
          ["Performance", "Catalog sync inventory lag", "< 5 seconds latency for inventory stock updates"],
          ["Availability", "Checkout and Cart systems", "99.99% availability (monitored via synthetic transactions)"],
          ["Compliance", "PCI DSS Compliance", "Level 1 delegation compliance; zero local storage of credit card numbers"],
        ],
        [2200, 2800, 4360]
      ),
      pageBreak(),

      // ─── SECTION 8: ROADMAP ───
      sectionDivider("08", "Implementation Roadmap & Phases"),
      spacer(1),
      h2("8.1  Development Phases"),
      para("The development of XIT Streamer is structured into four sequential phases over a 10-month timeline. This roadmap ensures a stable release of core functionalities before integrating complex enterprise features and third-party partner APIs."),
      spacer(1),
      makeTable(
        ["Phase", "Focus Area", "Key Deliverables", "Timeline"],
        [
          ["Phase 1", "Foundation & Core Stream Ingest", "Core Authentication, Platform Connection (YouTube/Meta), RTMP Ingestion, Stream Duplication Engine, Basic Creator Dashboard UI", "Months 1–3"],
          ["Phase 2", "Engagement & Moderation", "Unified Chat Aggregator (polling-based), Moderation Command Center (keyword blocklist, bans), Live Analytics Dashboard", "Months 4–5"],
          ["Phase 3", "AI Features & Commerce Core", "AI Copilot Integration (Claude/GPT-4 for reply suggestions and sentiment), E-commerce Catalog Synchronization, Custom Product Card Overlays, Mobile Responsiveness, Exportable PDF/CSV Reports", "Months 6–7"],
          ["Phase 4", "Enterprise, Agency & Social Commerce", "Agency Management Suite (multi-tenant workspaces, RBAC), Comment-to-Buy Engines (Facebook Messenger & Instagram DM), Shoppable HTML5 Web Player, TikTok Partner API integration, SSO Support, White-Labeling, System Health dashboards", "Months 8–10"]
        ],
        [1200, 2200, 4360, 1600]
      ),
      spacer(1),
      h2("8.2  Key Milestones and Gateways"),
      bullet("Milestone 1: Complete security audit of stream token encryption storage (End of Month 2)"),
      bullet("Milestone 2: Sub-200ms latency validation for live message duplication to YouTube/Meta endpoints (End of Month 4)"),
      bullet("Milestone 3: Meta App Review approval for live video and publishing scopes (End of Month 5)"),
      bullet("Milestone 4: TikTok Partner Program application submission and initial evaluation (End of Month 6)"),
      bullet("Milestone 5: Successful end-to-end load testing of 5,000 concurrent comment-to-buy DM triggers (End of Month 7)"),
      bullet("Milestone 6: Security validation of zero credit-card storage and merchant PCI audit sign-off (End of Month 8)"),
      bullet("Milestone 7: Production release of White-Label reporting and multi-tenant billing system (End of Month 9)"),
      pageBreak(),

      // ─── SECTION 9: COMPETITIVE ───
      sectionDivider("09", "Competitive Analysis"),
      spacer(1),
      h2("9.1  Market Positioning Matrix"),
      para("XIT Streamer targets the enterprise and talent agency segment of the creator economy. Unlike standard prosumer tools, XIT Streamer focuses on scalability, high-performance chat aggregation, multi-tenant governance, and AI-driven assistant tools."),
      spacer(1),
      makeTable(
        ["Competitor", "Target Audience", "Strengths", "Weaknesses", "XIT Advantage"],
        [
          ["Restream", "Prosumers & Gamers", "Broad platform support, mature RTMP engine, simple widget UI", "Weak historical analytics, lacks collaboration / agency hierarchy, basic AI features", "Enterprise RBAC (7 roles), white-label reports, advanced AI moderation"],
          ["StreamYard", "Businesses & Podcasters", "Excellent browser-based studio, easy guest onboarding, stable WebRTC", "No native agency dashboard, limited multi-profile management, high latency for custom RTMP", "High-throughput Kafka-based chat engine, specialized agency workflows"],
          ["OneStream", "Content Creators", "Scheduled pre-recorded streaming, cloud storage integrations", "Outdated dashboard design, poor real-time interaction features, minimal AI utility", "AI Copilot suggestions, modern density-appropriate UX design"],
          ["Sprii.io", "Brands & Live Retailers", "Seamless Shopify integration, comment-to-buy automation, overlay layouts", "Limited multi-platform analytics, lacks agency management, no RTMP studio for high-end feeds", "All-in-one broadcast studio, multi-channel support, advanced AI moderation & copilot"],
          ["XIT Streamer", "Enterprises & Agencies", "Unified real-time chat, AI Copilot assistance, multi-tenant workspace, white-labeled reporting", "New entrant, requires Meta/TikTok app approval cycles", "Best-in-class orchestration, dense layout, real-time analytics compliance"]
        ],
        [1500, 1800, 2000, 2000, 2060]
      ),
      pageBreak(),

      // ─── SECTION 10: RISK REGISTER ───
      sectionDivider("10", "Risk Register & Mitigations"),
      spacer(1),
      h2("10.1  Key Project Risks"),
      para("The following matrix identifies the primary technical, operational, and regulatory risks associated with the development and deployment of the XIT Streamer platform, along with corresponding impact levels and mitigation strategies."),
      spacer(1),
      makeTable(
        ["Risk Description", "Category", "Probability", "Impact", "Mitigation Strategy"],
        [
          ["TikTok private Live API access request is delayed or rejected", "Partnership / API", "High", "High", "Initiate partnership application immediately in Phase 1. Build manual custom RTMP configuration guidance as a fallback for users with stream keys."],
          ["Meta App Review blocks or delays live video publishing permissions", "Regulatory", "Medium", "High", "Develop compliance workflows strictly adhering to Meta standards. Submit sandboxed screencasts early in development phase."],
          ["Inventory synchronization delay leads to overselling", "Operational", "Medium", "Medium", "Implement Redis-based temporary inventory locks during draft order creation. Sync updates immediately on checkout webhooks."],
          ["Meta blockages of direct message flows due to spam policies", "Platform / API", "Medium", "High", "Implement strict rate-limiting on DM automation, use conversational opt-ins, and ensure compliance with Meta Messenger policies."],
          ["High chat volumes cause WebSocket socket exhaustion or UI lag", "Technical", "Medium", "Medium", "Implement Kafka messaging queue buffer, Redis Stream pub/sub caching, and client-side message batching (render updates every 100ms)."],
          ["OAuth tokens are compromised or leaked from database storage", "Security", "Low", "Critical", "Apply AES-256 encryption at rest. Implement strict access tokens refresh cycles and automatic database field isolation rules."],
          ["GDPR compliance complaint regarding stored user chat history", "Compliance", "Medium", "Medium", "Establish automatic retention policies to purge chat logs after 30 days. Provide a self-service data deletion portal for users."]
        ],
        [2200, 1400, 1200, 1200, 3360]
      ),
      pageBreak(),

      // ─── SECTION 11: RECOMMENDATIONS ───
      sectionDivider("11", "Recommendations for Leadership"),
      spacer(1),
      h2("11.1  Strategic Recommendations"),
      bullet("1. Meta App Review Submission: Leadership should prioritize the formal preparation of Meta Graph API applications. Developer accounts must be set up, sandboxed environments verified, and standard demo videos recorded to minimize standard review latency."),
      bullet("2. TikTok Partnership Program: Establish contacts with TikTok's creator partnership teams immediately. The Phase 2 roadmap should not commit resources to TikTok integration until partner-level API access is officially approved."),
      bullet("3. Unified Chat Differentiator: Focus engineering resources on optimization of the Unified Chat Aggregator. Achieving sub-200ms latency is the platform's primary unique selling proposition (USP) for agency clients."),
      bullet("4. Security Architecture First: Security policies (OAuth AES-256 encryption, database row-level security) must be implemented from day one of Phase 1, rather than treated as a post-MVP polishing item."),
      bullet("5. Automated SLA Verification: Implement continuous health monitoring (Prometheus, Grafana) from the start. Verify the 99.95% stream orchestration uptime target in staging before launching public beta trials."),
      bullet("6. E-Commerce Partner Alliances: Initiate technical discussions with Shopify and WooCommerce app store developer programs early. Securing placement in e-commerce app stores will lower merchant friction and accelerate user acquisition."),
      bullet("7. Cart and Checkout Optimization: Ensure the embedded shoppable web player's cart has a frictionless guest checkout experience. Support digital wallets like Apple Pay and Google Pay to maximize conversions during live sale events."),
      pageBreak(),

      // ─── SECTION 12: COSTING & INFRASTRUCTURE MODEL ───
      sectionDivider("12", "Costing & Infrastructure Model"),
      spacer(1),
      para("To build a highly profitable and scalable enterprise SaaS platform, we must optimize both application-layer resource consumption and network-layer bandwidth egress. This model breaks down platform API limits, payment processing fees, AI usage costs, and infrastructure pricing."),
      spacer(1),
      h2("12.1 Platform & Integration API Costs"),
      para("Most streaming and e-commerce APIs do not charge subscription or per-call fees, but they enforce strict transaction quotas. Scaling requires proper architecture to stay within limits:"),
      spacer(1),
      makeTable(
        ["Integration", "Base API Cost", "Rate Limit / Quota Structure", "Scale Impact & Mitigation"],
        [
          ["YouTube Data API v3", "Free", "10,000 quota units/day default. Each chat fetch consumes 1 unit.", "Chat polling at 500ms intervals consumes 120 units/minute per stream. 100 concurrent streams exhaust default daily quota in 50 minutes. Mitigation: Apply for Google Data API quota extension early."],
          ["Meta Graph API (FB/IG)", "Free", "Dynamic limit: 200 requests per active user per hour.", "Direct messaging (DM) automation does not charge fees but requires strict compliance to avoid anti-spam blocks."],
          ["Shopify API", "Free", "GraphQL: 1,000 cost points/sec. REST: 2 requests/sec.", "No billing overhead. High-frequency operations are batched via GraphQL mutations to preserve rate limit allocation."],
          ["WooCommerce API", "Free", "Rate limits determined by seller's hosting provider.", "No platform fees. Connection health depends on the merchant's hosting capacity."]
        ],
        [2000, 1600, 2200, 3560]
      ),
      spacer(1),
      h2("12.2 Payment Gateway Fees & Transactional Costs"),
      para("PCI compliance is delegated entirely to payment processors, avoiding direct security liabilities:"),
      bulletBoldLead("Stripe Processing Fees: ", "Standard card capture is billed at 2.9% + $0.30 per transaction."),
      bulletBoldLead("Stripe Connect Custom: ", "Paying out to creators costs $2.00 per active monthly express account + $0.25 per payout transfer."),
      bulletBoldLead("XIT Platform Fee Model: ", "XIT captures revenue through a combined monthly subscription (e.g., $49/mo) and a 0.5% to 1.0% platform transaction fee on Gross Merchandise Value (GMV) processed via comment-to-buy flows."),
      spacer(1),
      h2("12.3 Real-Time AI Engines (Claude API)"),
      para("AI services analyze audience sentiment, detect questions, and draft reply options:"),
      bulletBoldLead("Claude 3.5 Sonnet API: ", "Input tokens cost $3.00 per 1M tokens; output tokens cost $15.00 per 1M tokens."),
      bulletBoldLead("AI Cost per Creator Hour: ", "Assuming 1,000 comments per hour. Every minute, the system batches the last 20 comments (~400 tokens) and generates 3 replies + 3 highlighted questions (~150 tokens). For 60 requests per hour, input tokens cost $0.07 and output tokens cost $0.13, totaling ~$0.20 per streaming hour per creator."),
      bulletBoldLead("Local Model Fallback: ", "Toxicity filters and basic classification are routed to open-source Models (e.g., Llama-3-8B) on AWS ECS to reduce Claude API dependencies."),
      spacer(1),
      h2("12.4 Livestream Bandwidth & Compute Costs"),
      para("Outbound network egress is the single largest operational expense of a live replication system."),
      spacer(1),
      para("A creator streaming at 1080p60 (6 Mbps) generates 2.7 GB of ingress data per hour. Simulating that stream to 3 platforms results in 18 Mbps of egress data, totaling 8.1 GB per hour."),
      bulletBoldLead("AWS Standard NAT Egress ($0.08/GB): ", "Costs $0.65 per streaming hour. Scaling to 1,000 creators streaming 20 hours a month costs $13,000/month."),
      bulletBoldLead("Optimized Cloud Egress ($0.005/GB): ", "Routing egress via bandwidth-optimized networks (Akamai Linode, OVH) costs $0.04 per hour. For 1,000 creators, this drops bandwidth costs to $800/month."),
      bulletBoldLead("Compute Cost: ", "Because replication uses transcoding-free copy (-c copy), a c6i.xlarge instance ($0.17/hour) handles 30 concurrent creators. The compute cost is negligible at ~$0.005 per streaming hour."),
      spacer(1),
      h2("12.5 Infrastructure Cost Summary (Per 1,000 Active Creators)"),
      para("Below is a comparison of monthly costs between AWS-only NAT egress and a multi-cloud network routing structure:"),
      spacer(1),
      makeTable(
        ["Resource Category", "AWS Standard (NAT Gateway)", "Optimized Multi-Cloud (Akamai/OVH)"],
        [
          ["Network Egress (Bandwidth)", "$13,000 / month", "$800 / month"],
          ["Media Forwarding Compute", "$120 / month", "$120 / month"],
          ["Primary Databases (Postgres/Redis)", "$510 / month", "$510 / month"],
          ["Kafka Event Broker (MSK)", "$350 / month", "$350 / month"],
          ["EKS Application Gateway", "$400 / month", "$400 / month"],
          ["Transactional Email/SMS (SES/Twilio)", "$120 / month", "$120 / month"],
          ["Total Monthly Infrastructure Cost", "$14,500 / month", "$2,300 / month"],
          ["Average Cost per Creator (Active)", "$14.50 / month", "$2.30 / month"]
        ],
        [3360, 3000, 3000]
      ),
      spacer(1),
      h2("12.6 Cost Optimization Strategies for Engineers"),
      bullet("1. Enforce Target Bitrates: Lock the max ingest bitrate to 6 Mbps on the encoder to prevent unexpected bandwidth spike costs."),
      bullet("2. Circuit Breaker for Egress: If a destination platform drops, immediately disconnect the FFmpeg worker to cease unnecessary data transfer."),
      bullet("3. Dynamic Chat Polling: Slow down YouTube chat polling intervals during periods of low chat activity or when the creator minimizes their dashboard.")
    ]
  }]
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("XIT_STREAMER_Documentation.docx", buffer);
  console.log("Document created successfully as XIT_STREAMER_Documentation.docx");
}).catch((err) => {
  console.error("Error packaging document:", err);
});
