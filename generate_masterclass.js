const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TabStopType, ImageRun
} = require('docx');
const fs = require('fs');
const https = require('https');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

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

function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
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
  const borderLeft = { style: BorderStyle.SINGLE, size: 12, color: borderColor };
  const borderRest = { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" };
  const customBorders = { top: borderRest, bottom: borderRest, left: borderLeft, right: borderRest };

  if (title) {
    rows.push(new TableRow({
      children: [new TableCell({
        borders: customBorders,
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: borderColor, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        children: [new Paragraph({ children: [new TextRun({ text: title, font: "Arial", size: 20, bold: true, color: "FFFFFF" })] })]
      })]
    }));
  }
  items.forEach(item => {
    rows.push(new TableRow({
      children: [new TableCell({
        borders: customBorders,
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: color, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 160, right: 160 },
        children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: item, font: "Arial", size: 20 })] })]
      })]
    }));
  });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows });
}

function codeBlock(text) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          left: { style: BorderStyle.SINGLE, size: 12, color: "9CA3AF" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" }
        },
        shading: { fill: "F9FAFB", type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: text.split('\n').map(line => new Paragraph({
          spacing: { before: 20, after: 20 },
          children: [new TextRun({ text: line, font: "Courier New", size: 16, color: "111827" })]
        }))
      })]
    })]
  });
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

function downloadMermaid(code) {
  return new Promise((resolve, reject) => {
    const obj = {
      code: code,
      mermaid: { theme: 'default' }
    };
    const json = JSON.stringify(obj);
    const base64 = Buffer.from(json).toString('base64');
    const url = `https://mermaid.ink/img/${base64}`;

    https.get(url, function(response) {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', function(err) {
      reject(err);
    });
  });
}

const mermaidCode = `graph TD
    Creator[Creator / Webcam / OBS] -->|RTMP or WebRTC| Ingest[XIT Streamer Ingest Engine]
    Ingest -->|Replication & Forwarding| YT[YouTube Live]
    Ingest -->|Replication & Forwarding| FB[Facebook Live]
    Ingest -->|Replication & Forwarding| IG[Instagram Live]
    Ingest -->|Replication & Forwarding| Custom[Custom Storefront Embed]
    
    YT -->|Chat Feed & Events| Aggregator[XIT Chat Aggregator]
    FB -->|Chat Feed & Events| Aggregator
    IG -->|Chat Feed & Events| Aggregator
    
    Aggregator -->|Comment-to-Buy Detection| Commerce[Commerce & Order Service]
    Commerce -->|Draft Order & DM Dispatch| Ecom[Shopify / WooCommerce / Stripe]
    Ecom -->|Webhook Purchase Confirmation| Overlays[Live Stream Overlays Engine]`;

async function main() {
  console.log("Downloading mermaid diagram...");
  let mermaidBuffer = null;
  try {
    mermaidBuffer = await downloadMermaid(mermaidCode);
    console.log("Mermaid diagram downloaded successfully!");
  } catch (err) {
    console.error("Failed to download mermaid diagram, using code block fallback:", err.message);
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
                new TextRun({ text: "  |  Creator Operations & Live Shopping Masterclass", font: "Arial", size: 16, color: "6B7280" })
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
                new TextRun({ text: "XIT Streamer Blueprint  |  Definitive Reference Manual", font: "Arial", size: 16, color: "6B7280" }),
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
          children: [new TextRun({ text: "Product & Technical Architecture Masterclass", font: "Arial", size: 32, bold: true, color: "374151" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 600 },
          children: [new TextRun({ text: "A Complete First-Principles Blueprint for Engineers, PMs, and Architects", font: "Arial", size: 20, color: "6B7280", italics: true })]
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
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "Engineering, Product & Leadership Teams", font: "Arial", size: 20, bold: true, color: "1A56DB" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "Date: June 2026     |     Classification: Confidential Reference", font: "Arial", size: 18, color: "6B7280" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: "Version: 1.0  |  Status: Reference Document", font: "Arial", size: 18, color: "6B7280" })] })
            ]
          })]})],
        }),
        pageBreak(),

        // ─── SECTION 1: PRODUCT & BUSINESS VISION ───
        sectionDivider("01", "Product & Business Vision"),
        spacer(1),
        h2("Overall Vision"),
        para("XIT Streamer is an enterprise-grade Creator Operations & Live Shopping Platform. Its goal is to unify multi-platform livestreaming, real-time interactive social commerce, audience moderation, unified analytics, and agency-level talent management into a single, cohesive, high-performance ecosystem."),
        spacer(1),
        ...(mermaidBuffer 
          ? [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 120 },
                children: [
                  new ImageRun({
                    data: mermaidBuffer,
                    transformation: {
                      width: 450,
                      height: 450
                    }
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 120 },
                children: [new TextRun({ text: "Figure 1: Creator Operations & Live Shopping Flow", font: "Arial", size: 16, italics: true, color: "6B7280" })]
              })
            ]
          : [codeBlock(mermaidCode)]
        ),
        spacer(1),
        h2("The Business Problems Solved"),
        bulletBoldLead("1. Audience Fragmentation: ", "Audiences are split across platforms (YouTube, Instagram, TikTok, Facebook). Multi-platform streaming (simulcasting) typically requires high local upload bandwidth or expensive prosumer tools that offer zero interaction tools."),
        bulletBoldLead("2. Chat & Moderation Desynchronization: ", "Creators must monitor separate chat windows for each platform. Inconsistencies in moderation policies, keyword blacklists, and block lists make it nearly impossible to protect a brand across channels simultaneously."),
        bulletBoldLead("3. Friction in Social Commerce (Live Selling): ", "Traditional live shopping forces users to click external links, leading to massive cart abandonment (up to 75-80%). XIT solves this through Comment-to-Buy automation, sending personalized checkouts directly to users' direct messages (DMs) where they already converse."),
        bulletBoldLead("4. Lack of Governance for Agencies: ", "Talent agencies managing dozens of creators have no centralized governance, unified analytics reporting, white-label client tools, or role-based access controls (RBAC) to manage creators' OAuth platform credentials safely."),
        spacer(1),
        h2("Target Users and Use Cases"),
        bulletBoldLead("Enterprise Brands & E-commerce Retailers: ", "Launching product drops simultaneously on Instagram Live, Facebook, and their own online store, letting viewers buy instantly by commenting #buy-item."),
        bulletBoldLead("Talent Agencies & Creator Managers: ", "Managing credentials, scheduling streams, monitoring performance, and compiling sponsor-ready campaign reports for multiple creators."),
        bulletBoldLead("Professional Gamers & Influencers: ", "Distributing high-definition feeds (1080p60) to YouTube, Twitch, and custom destinations while using an AI Copilot to surface top chat questions and automate chat moderation."),
        spacer(1),
        h2("Competitive Positioning"),
        bulletBoldLead("Restream / StreamYard (Prosumer): ", "Focus on basic multi-platform streaming, simple graphics, or guest WebRTC joins. They lack deep agency management, enterprise RBAC, transactional social commerce tools, and custom webhook-driven web widgets."),
        bulletBoldLead("Sprii.io / Livescale (Pure Live Commerce): ", "Focus heavily on e-commerce catalog integrations, but lack native multi-platform streaming studios, developer-grade API gateways, advanced AI moderation, and agency governance tools."),
        bulletBoldLead("XIT Streamer (Enterprise Operations & Commerce): ", "Unifies professional RTMP streaming duplication with real-time Kafka-based chat commerce, advanced AI sentiment models, and multi-tenant agency management."),
        pageBreak(),

        // ─── SECTION 2: SCREEN-BY-SCREEN APPLICATION WALKTHROUGH ───
        sectionDivider("02", "Screen-by-Screen Application Walkthrough"),
        spacer(1),
        para("XIT Streamer is designed as a density-appropriate layout. Screens targeting the active stream (Dashboard) are information-dense, dark-mode first, and high-contrast, similar to Datadog or a trading terminal. Administrative screens (onboarding, reporting) use a clean, guided layout."),
        spacer(1),
        h2("1. Unified Authentication & Workspaces"),
        bullet("Login/Signup Screen: Standard email/password, Google/Meta OAuth, and mandatory Multi-Factor Authentication (MFA) via TOTP."),
        bullet("Workspace Selector: Users choose between personal profiles or collaborative agency workspaces."),
        bullet("Team Invite Dashboard: Agency owners invite Managers or Moderators, assigning granular permissions (RBAC)."),
        spacer(1),
        h2("2. Platform Connection Center (OAuth Integration)"),
        h3("The Connection Mechanism"),
        para("To maximize security and eliminate setup friction, users do not provide raw API keys or developer credentials. Instead, connections are established via standard secure redirect handshakes:"),
        bulletBoldLead("Social Accounts: ", "Clicking \"Connect\" redirects the user to Google (YouTube) or Meta (Facebook/Instagram) login screens. The user approves the requested permissions, and the social platforms redirect back to XIT with an Authorization Code, which the backend exchanges for long-lived Access and Refresh Tokens encrypted with AES-256 at rest."),
        bulletBoldLead("E-commerce Stores (e.g., Shopify): ", "The user enters their store sub-domain (e.g., brand.myshopify.com). XIT redirects them to the Shopify App Authorization page where they click \"Install App.\" Shopify issues an offline access token to XIT. (A developer fallback option allows manually pasting custom API access keys for headless storefronts)."),
        spacer(1),
        bulletBoldLead("Connected Accounts Grid: ", "Displays active integrations."),
        bulletBoldLead("Card Details: ", "Profile picture, platform tag, token expiry countdown, connection status (Green = Connected, Yellow = Expired, Red = Revoked/Error)."),
        bulletBoldLead("Action Tray: ", "\"Reauthorize,\" \"Disconnect,\" \"Verify Connection Health.\""),
        spacer(1),
        h2("3. E-commerce Integration Hub"),
        bulletBoldLead("Store Connector: ", "Input Shopify Domain, WooCommerce URL, or custom API keys."),
        bulletBoldLead("Catalog Manager: ", "Shows a paginated grid of synced products: product image, SKU, description, pricing, inventory stock status, and custom Purchase Trigger Keyword (e.g., #blue-shirt-medium)."),
        spacer(1),
        h2("4. Stream Creation Studio"),
        bulletBoldLead("Stream Details Form: ", "Title, description, schedule date, visual thumbnail (drag-and-drop crop tool), and category."),
        bulletBoldLead("Platform Selector Toggle Panel: ", "Enable/disable specific channels. Each toggle expands to reveal platform-specific overrides (e.g., YouTube latency mode, Facebook crossposting groups, Instagram visibility)."),
        bulletBoldLead("Product Tagging Selector: ", "Search catalog and link specific items to the stream, configuring the dynamic purchase code overrides."),
        spacer(1),
        h2("5. Live Stream Control Center (The Terminal)"),
        para("This is the master screen during an active live stream. It is structured in a three-column layout:"),
        bulletBoldLead("Left Column (Stream Health & Overlays): ", "Real-time encoding metrics (FPS gauge, audio input meters, bitrate chart, packet loss alerts), Ingest endpoint credentials (Server RTMP URL + Stream Key), and interactive overlay controller (toggles product cards, discount banners, spin-to-win widgets on/off)."),
        bulletBoldLead("Center Column (Unified Chat Aggregator): ", "Real-time scrolling feed containing messages from YouTube, Facebook, and Instagram. Each card displays user avatar, username, color-coded platform badge, comment, and timestamp. A right-click context menu provides options like Pin, Highlight on Screen, Delete, Timeout User, and Permanent Ban."),
        bulletBoldLead("Right Column (Live Commerce & Analytics): ", "Live Sales Funnel (Active Viewers, Link Dispatches, Carts Created, Completed Orders, Real-time GMV counter), Product Spotlight Panel (Highlights the current active product card and shows stock remaining), and AI Copilot Sidebar (Surfaced audience questions, real-time sentiment analysis meter, and copy-paste suggested chat replies)."),
        pageBreak(),

        // ─── SECTION 3: TECHNICAL ARCHITECTURE DEEP-DIVE ───
        sectionDivider("03", "Technical Architecture Deep-Dive"),
        spacer(1),
        h2("End-to-End Microservices Architecture"),
        para("XIT Streamer utilizes a containerized, decoupled microservices model orchestrated via Kubernetes (AWS EKS). Communication is handled via REST/GraphQL API Gateway for external requests, and Apache Kafka/Redis Streams for internal event processing."),
        spacer(1),
        codeBlock(`                                  [ Next.js Presentation Layer ]
                                                 | (WebSocket / HTTPS)
                                    [ NestJS API Gateway / Kong ]
                                                 |
         +--------------------+------------------+------------------+------------------+
         |                    |                  |                  |                  |
   [ Auth Service ]   [ Stream Service ]  [ Chat Service ]  [ Commerce Service ] [ Analytics Service ]
         |                    |                  |                  |                  |
    (PostgreSQL)         (Postgres/Redis)  (Kafka/Redis)     (Shopify API/Stripe)  (ClickHouse/Mongo)`),
        spacer(1),
        h2("Core Services Breakdown"),
        bulletBoldLead("1. Authentication Service: ", "Manages multi-tenant credentials, workspace permissions, SAML/SSO integrations, and encrypted OAuth vault storage."),
        bulletBoldLead("2. Stream Service & Orchestrator: ", "Handles stream scheduling, generates ingest endpoints, triggers FFmpeg workers, and monitors stream health."),
        bulletBoldLead("3. Chat Aggregation Service: ", "Houses the platform adapters that poll or read webhooks from YouTube, Facebook, and Instagram, forwarding normalized JSON structures."),
        bulletBoldLead("4. Commerce & Order Service: ", "Manages e-commerce webhook listeners, handles catalog synchronizations, maps comments to SKUs, and issues draft orders."),
        bulletBoldLead("5. Analytics Engine: ", "Ingests high-throughput metric streams (viewers, transactions, chats) and updates memory caches (Redis) and analytical data warehouses (ClickHouse)."),
        pageBreak(),

        // ─── SECTION 4: KEY WORKFLOWS & ENGINEERING IMPLEMENTATION ───
        sectionDivider("04", "Key Workflows & Engineering Implementation"),
        spacer(1),
        h2("1. Stream Ingest & Replication (The Streaming Engine)"),
        para("XIT Streamer supports three streaming input methods depending on creator preference:"),
        bulletBoldLead("WebRTC Ingest (Zero-Install Browser Studio): ", "Captures the webcam and microphone directly within Chrome/Safari via HTML5 MediaStream APIs and streams low-latency WebRTC streams to our server, which translates them to RTMP."),
        bulletBoldLead("Mobile App Ingest (iOS/Android): ", "Compresses mobile hardware camera frames and streams over RTMP or SRT directly from a mobile phone."),
        bulletBoldLead("OBS Studio / External Hardware (RTMP Ingest): ", "Alex copies the RTMP Server URL and Stream Key into professional software (OBS, vMix) or hardware capture cards."),
        spacer(1),
        codeBlock(`[ Ingest Stream (RTMP/WebRTC) ] ---> [ SRS Ingest Server ]
                                             |
                                             v
                                 [ Spawn FFmpeg process ]
                                             |
                +----------------------------+----------------------------+
                |                            |                            |
       (RTMP Push Protocol)         (RTMP Push Protocol)         (RTMP Push Protocol)
                v                            v                            v
         [ YouTube Live ]             [ Facebook Live ]            [ Instagram Live ]`),
        spacer(1),
        h3("Under the Hood: The \"Replication & Forwarding\" Pipeline Explained"),
        para("When Alex starts streaming from his house, his computer sends only one video feed (e.g., 6 Mbps upload data) to XIT's cloud gateway to avoid choking his home internet upload speed."),
        numbered("Ingest: The stream hits our SRS (Simple RTMP Server) ingest port."),
        numbered("Worker Spawning: SRS detects the inbound stream and triggers a script that spawns a dedicated FFmpeg process in our container cluster mapped to Alex's session."),
        numbered("The Duplication Event: FFmpeg acts as an in-memory packet copy-paster. Using the parameters -c:v copy -c:a copy (codec copy), FFmpeg does not decode or re-encode the incoming video. It takes the raw, encoded H.264/AAC packets, duplicates them into three identical binary streams in system RAM, and forwards them in parallel:"),
        codeBlock(`ffmpeg -i rtmp://localhost/live/stream_alex_123 \\
       -c copy -f flv rtmp://a.rtmp.youtube.com/live2/youtube_key \\
       -c copy -f flv rtmps://live-api-s.facebook.com:443/rtmp/facebook_key \\
       -c copy -f flv rtmps://live-upload.instagram.com:443/rtmp/instagram_key`),
        numbered("Why it is critical: By duplicating raw packets without rendering video frames, the server uses almost zero CPU. This allows a single compute node to duplicate streams for 30+ creators concurrently, keeping latency sub-second and keeping hosting bills low."),
        spacer(1),
        h2("2. Unified Chat & Comment-to-Buy Automation"),
        codeBlock(`[ YouTube API Polling ] ---\\
[ Facebook Webhook ]    ----+--> [ normalized-chats Kafka Topic ] --> [ Normalization Worker ]
[ Instagram Polling ]   ---/                                                  |
                                                                              v
                                                                   [ Regex Pattern Matcher ]
                                                                              |
                                                          +-------------------+-------------------+
                                                          | (Match Found)                         | (No Match)
                                                          v                                       v
                                                [ Commerce Sync Worker ]                 [ Redis Stream ]
                                                          |                                       |
                                                          v                                       v
                                                [ DM Dispatcher / BullMQ ]             [ Live Dashboard WebSocket ]`),
        spacer(1),
        h3("How it works:"),
        bulletBoldLead("Ingestion: ", "Adapters fetch messages via Meta Webhooks (Facebook comments) or API polling threads (YouTube LiveChatMessages API at 500ms intervals)."),
        bulletBoldLead("Buffering (Kafka): ", "Raw messages are pushed to a partitioned Kafka topic normalized-chats to prevent buffer overflows during high-velocity streams."),
        bulletBoldLead("Normalization: ", "Workers consume the raw messages and map them to a strict schema."),
        bulletBoldLead("Regex Processing: ", "The message parser runs a pattern matching algorithm: /^buy\\s+#(?<sku>[a-zA-Z0-9_-]+)$/i."),
        bulletBoldLead("Purchase Intent Flow: ", "If a match is found, the parser triggers the Commerce Sync Worker. The worker checks Shopify/WooCommerce inventory status in Redis. If stock is available, it makes an API call to the storefront to create a draft order, reserving the item for 15 minutes. The worker pushes a message to dm-delivery-queue (handled by BullMQ). The DM Dispatcher pulls the task and calls Meta’s API to send a direct message with a pre-populated secure Stripe/Shopify Pay checkout URL. Simultaneously, the normalized comment is published to Redis Streams, which updates the creator’s Live Dashboard WebSocket feed."),
        spacer(1),
        h2("3. Visual Overlays & Clickability Constraints"),
        h3("The Platform Restriction"),
        para("When streaming to third-party social apps (YouTube, Instagram, Facebook), the output feed is a flat, single-layer H.264 video matrix. The player on the viewer's device only receives raw pixels; the overlay graphics embedded in the video stream are not clickable."),
        spacer(1),
        h3("Clickable Workarounds Implemented by XIT Streamer:"),
        para("To bypass this social platform limitation and ensure high conversions, XIT Streamer uses three distinct workflows:"),
        bulletBoldLead("1. Comment-to-Buy Direct Messages (Sprii.io Model): ", "Viewers cannot click the screen, so they comment a code (e.g., buy #chair). XIT's parser intercepts the comment and calls Meta's Graph API to immediately drop a clickable checkout card link into the user's Instagram DM or Facebook Messenger inbox, letting them complete the transaction in their chats."),
        bulletBoldLead("2. Interactive Website HTML Player: ", "On the creator's personal website (where they embed the widget player), XIT has absolute control over the web interface. XIT renders responsive HTML/CSS interactive buttons layered on top of the player canvas. When viewers watch on the brand's store website, they can click the visual cards directly to add items to their shopping cart on the same page."),
        bulletBoldLead("3. Dynamic Pinned Links in Chat: ", "When Alex highlights a product in his control center, XIT automatically calls YouTube/Facebook APIs to update and pin a clickable URL to the top of the live chat scroll feed."),
        pageBreak(),

        // ─── SECTION 5: PLATFORM CONNECTIONS & TOKEN LIFECYCLE ───
        sectionDivider("05", "Platform Connections & Token Lifecycle"),
        spacer(1),
        h2("OAuth Authorization Flow"),
        para("Authorization is a one-time setup process, not an every-time requirement. When a user connects Google or Meta channels, XIT requests permission scopes (e.g., publish_video, live_video)."),
        bulletBoldLead("Access Tokens: ", "Standard short-lived tokens (expires in 1 hour for Google, 2 hours for Meta)."),
        bulletBoldLead("Refresh Tokens: ", "Long-lived offline tokens (expires in 60 days to 1 year, or until explicitly revoked by the user)."),
        bulletBoldLead("Token Rotation Worker: ", "XIT runs a background cron task that checks token expiry arrays. If an active channel's Access Token is within 15 minutes of expiration, XIT automatically calls Meta/Google token endpoints with the stored Refresh Token, exchanging it for a new access token without interrupting the creator."),
        spacer(1),
        h2("E-commerce Integration Flow (Shopify)"),
        para("The Shopify integration is managed as a standalone, multi-tenant e-commerce sync module:"),
        numbered("OAuth Installation: The creator enters their store domain (alex-shop.myshopify.com). XIT redirects them to Shopify's secure OAuth consent screen. Upon installation, Shopify issues a permanent offline Access Token."),
        numbered("Webhooks Registration: Rather than polling Shopify for inventory changes, XIT calls Shopify's Webhook API during initialization to register webhook subscriptions for products/update, products/delete, and inventory_levels/update."),
        numbered("Real-time Product Syncing: Any inventory depletion or item updates on Shopify trigger an instant HTTPS payload from Shopify's servers to XIT's API gateway. XIT updates the Redis Cache database, keeping catalog info synced to <100ms."),
        numbered("Draft Orders Pipeline: When a buy comment is validated, XIT executes a Shopify GraphQL draftOrderCreate mutation, which reserves inventory stock. Shopify returns a secure invoiceUrl containing the customer cart page."),
        numbered("Payment Completion Loop: XIT subscribes to Shopify's orders/create webhook. Once the user pays, Shopify updates XIT, releasing inventory holds and triggering on-stream alerts."),
        spacer(1),
        h2("Disaster Recovery & Failure Modes"),
        codeBlock(`[ Failure Type ] ----------> [ Detection Method ] ----------> [ Automated Recovery Strategy ]
Token Expiration            401 Unauthorized / Token Check   Auto-call refresh endpoint in background
Token Revocation            invalid_grant Error              Flag connection as 'Revoked'; Send reconnect email
API Gateway Down            Connection Timeout               Enable Circuit Breaker; Queue payload in Kafka
Rate Limits Hit             429 Too Many Requests            Backoff polling frequency; Apply Token Bucket limit`),
        spacer(1),
        bulletBoldLead("Token Revocation / Authentication Errors: ", "If a user changes their Facebook password or revokes XIT's access from their Google Security portal, the refresh token fails with an invalid_grant exception. XIT catches the exception, updates the account connection card status to \"Revoked (Red)\", pauses API polling threads for that account to avoid API blocks, and fires a transactional email/push notification containing a one-click \"Reconnect Account\" redirect link."),
        bulletBoldLead("Third-Party API Downtime: ", "Implement Circuit Breaker patterns. If Meta's Graph API is down, XIT blocks outgoing calls, caches generated comments in Kafka logs, and retries after a cooldown delay."),
        bulletBoldLead("Rate Limits and Quotas (e.g., YouTube Quota limits): ", "Implement a token bucket rate-limiter. If XIT receives a 429 Too Many Requests or quota exhaustion warnings, it dynamically scales back comment polling intervals (e.g., from 500ms to 2500ms) and batches outgoing API requests to maximize efficiency."),
        pageBreak(),

        // ─── SECTION 6: TECHNOLOGY STACK ───
        sectionDivider("06", "Technology Stack"),
        spacer(1),
        para("The production architecture is built using a modern, scalable enterprise stack designed for high throughput, data integrity, and low-latency stream forwarding:"),
        spacer(1),
        makeTable(
          ["Category", "Technology", "Justification"],
          [
            ["Frontend Framework", "Next.js 14 + React 18 + TypeScript", "SSR/SSG capabilities; App Router for nested layouts; TypeScript for type safety."],
            ["Styling & UI", "TailwindCSS + ShadCN UI", "Utility-first CSS; pre-built accessible components; consistent design tokens."],
            ["Animations", "Framer Motion", "Production-grade animation library for GPU-accelerated micro-interactions."],
            ["Backend Framework", "NestJS (Node.js + TypeScript)", "Modular microservices framework; built-in dependency injection; enterprise patterns."],
            ["Primary Database", "PostgreSQL 15", "ACID compliance for orders; Row-Level Security (RLS) for tenant isolation."],
            ["Cache Database", "Redis 7 (Redis Streams)", "Sub-millisecond inventory cache locks (Redlock); real-time socket message cache."],
            ["Message Broker", "Apache Kafka", "High-throughput ingestion partition queue for social comment feeds."],
            ["In-App Queue Manager", "BullMQ (Redis-backed)", "Reliable distributed queue for outbound DM link dispatches."],
            ["Stream Ingest", "SRS (Simple RTMP Server) & Janus SFU", "SRS for high-performance RTMP ingest; Janus SFU for Browser WebRTC ingest."],
            ["Stream Duplication", "FFmpeg", "Transcoding-free copy (-c copy) for packet-level duplication in system RAM."],
            ["E-Commerce Sync", "Shopify GraphQL & REST Webhooks", "GraphQL API for catalog sync and draft orders; REST webhooks for inventory status."],
            ["Payment Gateway", "Stripe Connect SDK & Shopify Pay", "Delegated PCI-compliant checkout sessions and payout systems for creators."],
            ["Containerization", "Docker & Kubernetes (AWS EKS)", "Horizontal service scaling and cloud isolation."],
            ["Monitoring", "Prometheus & Grafana", "Real-time service health, Kafka lag, and socket counts monitoring."],
            ["AI Pipeline", "Anthropic Claude 3.5 Sonnet API", "AI Copilot analysis, sentiment tracking, and chat reply generation."]
          ],
          [2200, 2800, 4360]
        ),
        pageBreak(),

        // ─── SECTION 7: COMPARISON OF INGEST PROTOCOLS ───
        sectionDivider("07", "Comparison of Streaming Ingest Protocols"),
        spacer(1),
        makeTable(
          ["Protocol Option", "Ingest Protocol", "Transcoding Needs", "Pros", "Cons", "Infrastructure Setup", "Competitor Support"],
          [
            ["Web Browser Studio", "WebRTC (SRTP/DTLS)", "High. Must transcode VP8/VP9 from browser into H.264 for RTMP push.", "Zero software installation; works in Chrome/Safari; easiest onboarding.", "High server CPU load; webcam resolution limits; limited custom overlay support.", "Needs WebRTC SFU Gateway (Janus/Mediasoup) + CPU-intensive FFmpeg transcoding nodes.", "StreamYard Studio, Restream Studio, Livescale."],
            ["Broadcasting Software (OBS)", "RTMP / RTMPS", "Zero. Directly copies H.264/AAC packets (-c copy).", "High production quality (1080p60); support for multiple cameras & complex overlays.", "Requires software installation; higher learning curve for creators.", "Low server CPU load (transcoding-free forwarding).", "Restream, StreamYard (RTMP Ingest), Livescale, Sprii."],
            ["Mobile Streaming App", "RTMP / SRT", "Low-to-Medium.", "High portability; perfect for physical retail stores or pop-up events.", "High battery drain; phone heats up; quality depends on cellular data speeds.", "Low server CPU (H.264 native ingestion).", "Sprii Host App, CommentSold."]
          ],
          [1500, 1100, 1100, 1400, 1400, 1460, 1400]
        ),
        pageBreak(),

        // ─── SECTION 8: COMPETITIVE ANALYSIS: SPRII.IO ───
        sectionDivider("08", "Competitive Analysis: Sprii.io In-Depth Research"),
        spacer(1),
        para("Sprii.io is a specialized live-commerce solution built to monetize live broadcasting via social commerce."),
        spacer(1),
        h2("1. How Creators Go Live"),
        bulletBoldLead("Mobile-First Setup: ", "Sprii focuses heavily on mobile streaming. Creators download the Sprii Host App on iOS and use their phone’s camera."),
        bulletBoldLead("OBS Integration: ", "Sprii also offers a \"Streaming\" tab displaying an RTMP URL and Key, allowing creators to hook up DSLRs or professional multicam hardware via OBS Studio."),
        spacer(1),
        h2("2. Product Sync & E-commerce Architecture"),
        bulletBoldLead("Shopify App Store integration: ", "Merchants install Sprii from the Shopify App store. Catalog titles, images, descriptions, pricing, and quantities are pulled into Sprii."),
        bulletBoldLead("Comment-to-Buy Mechanics: ", "Sprii's parsing engine listens to comments. It is designed to match trigger keywords even when containing minor typos, misspellings, or emojis (e.g., matching \"buy #chair\", \"buy chair\", or \"chair 👍\" to the same product)."),
        bulletBoldLead("Inventory Synchronization: ", "Real-time bi-directional catalog checks prevent overselling. If a product cart is abandoned, Sprii notifies Shopify to release the item lock."),
        spacer(1),
        h2("3. Overlays & Checkout Flows"),
        bulletBoldLead("Overlays: ", "Non-clickable on social channels (Instagram, Facebook). Sprii projects the spotlight cards visually onto the feed and auto-sends checkout cart URLs to the viewer’s Instagram DM or Facebook Messenger."),
        bulletBoldLead("Cart Redirect vs. Draft Order: ", "Sprii supports adding items directly to a customer's website shopping cart or generating automated Draft Orders, redirecting them to the merchant's secure Shopify checkout."),
        spacer(1),
        h2("4. Strengths & Weaknesses of Sprii"),
        h3("Strengths:"),
        bullet("Frictionless mobile hosting via native iOS app."),
        bullet("Typo-tolerant comment parsing."),
        bullet("Reliable, bi-directional Shopify inventory alignment."),
        h3("Weaknesses:"),
        bullet("Lacks advanced multi-platform streaming tools (focused almost entirely on Meta channels)."),
        bullet("No advanced AI Copilot assistance (e.g., question detection, automated moderation suggestions)."),
        bullet("Weak talent agency governance (no collaborative multi-user RBAC for credential sharing)."),
        spacer(1),
        h2("Key Architectural Lessons for XIT Streamer:"),
        bulletBoldLead("1. Typo-Tolerant Parsing Engine: ", "Adopt a fuzzy-matching logic (e.g., Levenshtein distance) in our Kafka parser so that when a viewer comments buy #chari instead of buy #chair, XIT still triggers the DM checkout link."),
        bulletBoldLead("2. Flexible Cart Checkout Modes: ", "Support both \"Direct Checkout Link\" (Stripe Connect) and \"E-commerce Shopping Cart Sync\" (redirecting to a Shopify cart)."),
        pageBreak(),

        // ─── SECTION 09: COMPLIANCE, LEGAL & REGULATORY FRAMEWORKS ───
        sectionDivider("09", "Compliance, Legal & Regulatory Frameworks"),
        spacer(1),
        h2("1. Payment Security (PCI DSS)"),
        bulletBoldLead("Design Decision: ", "XIT Streamer never receives, processes, or stores credit card numbers on its database."),
        bulletBoldLead("Implementation: ", "The platform delegates the checkout workflow to Stripe Checkout Sessions and Shopify Pay. Checkout sessions use encrypted secure tokens, and XIT only listens to webhook notifications (payment_intent.succeeded) to flag items as purchased."),
        spacer(1),
        h2("2. GDPR & CCPA Data Privacy"),
        bulletBoldLead("Data Residency: ", "OAuth credentials and workspace settings of EU clients must reside on AWS Frankfurt database instances."),
        bulletBoldLead("Right to Be Forgotten: ", "Implement a cascading delete mechanism that purges user records, OAuth tokens, and analytics caches across PostgreSQL, MongoDB, and Redis within 30 days of request."),
        bulletBoldLead("Consent Audits: ", "Log records of consent for data capture (chat aggregation) and keep strict audit paths."),
        spacer(1),
        h2("3. Intermediary Liability (Section 230, DMCA, DSA)"),
        bulletBoldLead("The Shield: ", "XIT acts as a pass-through distribution network."),
        bulletBoldLead("Safe Harbor Execution: ", "To maintain DMCA Section 512 safe harbor, XIT registers a legal agent with the US Copyright Office, lists notice-and-action routes in the terms of service, and implements automated tools to disconnect streams upon receipt of valid platform DMCA copyright claims."),
        pageBreak(),

        // ─── SECTION 10: COSTING & INFRASTRUCTURE MODEL ───
        sectionDivider("10", "Costing & Infrastructure Model"),
        spacer(1),
        para("To build a highly profitable and scalable enterprise SaaS platform, we must optimize both application-layer resource consumption and network-layer bandwidth egress. This model breaks down platform API limits, payment processing fees, AI usage costs, and infrastructure pricing."),
        spacer(1),
        h2("10.1 Platform & Integration API Costs"),
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
        h2("10.2 Payment Gateway Fees & Transactional Costs"),
        para("PCI compliance is delegated entirely to payment processors, avoiding direct security liabilities:"),
        bulletBoldLead("Stripe Processing Fees: ", "Standard card capture is billed at 2.9% + $0.30 per transaction."),
        bulletBoldLead("Stripe Connect Custom: ", "Paying out to creators costs $2.00 per active monthly express account + $0.25 per payout transfer."),
        bulletBoldLead("XIT Platform Fee Model: ", "XIT captures revenue through a combined monthly subscription (e.g., $49/mo) and a 0.5% to 1.0% platform transaction fee on Gross Merchandise Value (GMV) processed via comment-to-buy flows."),
        spacer(1),
        h2("10.3 Real-Time AI Engines (Claude API)"),
        para("AI services analyze audience sentiment, detect questions, and draft reply options:"),
        bulletBoldLead("Claude 3.5 Sonnet API: ", "Input tokens cost $3.00 per 1M tokens; output tokens cost $15.00 per 1M tokens."),
        bulletBoldLead("AI Cost per Creator Hour: ", "Assuming 1,000 comments per hour. Every minute, the system batches the last 20 comments (~400 tokens) and generates 3 replies + 3 highlighted questions (~150 tokens). For 60 requests per hour, input tokens cost $0.07 and output tokens cost $0.13, totaling ~$0.20 per streaming hour per creator."),
        bulletBoldLead("Local Model Fallback: ", "Toxicity filters and basic classification are routed to open-source Models (e.g., Llama-3-8B) on AWS ECS to reduce Claude API dependencies."),
        spacer(1),
        h2("10.4 Livestream Bandwidth & Compute Costs"),
        para("Outbound network egress is the single largest operational expense of a live replication system."),
        spacer(1),
        codeBlock(`[ Creator Ingest: 1x 1080p Stream (6 Mbps) ]
                    |
                    v
          [ XIT Duplication Engine ]
                    |
      +-------------+-------------+
      | (Egress 6M) | (Egress 6M) | (Egress 6M)
      v             v             v
 [ YouTube ]   [ Facebook ]  [ Instagram ]  --> Total Egress = 18 Mbps`),
        spacer(1),
        para("A creator streaming at 1080p60 (6 Mbps) generates 2.7 GB of ingress data per hour. Simulating that stream to 3 platforms results in 18 Mbps of egress data, totaling 8.1 GB per hour."),
        bulletBoldLead("AWS Standard NAT Egress ($0.08/GB): ", "Costs $0.65 per streaming hour. Scaling to 1,000 creators streaming 20 hours a month costs $13,000/month."),
        bulletBoldLead("Optimized Cloud Egress ($0.005/GB): ", "Routing egress via bandwidth-optimized networks (Akamai Linode, OVH) costs $0.04 per hour. For 1,000 creators, this drops bandwidth costs to $800/month."),
        bulletBoldLead("Compute Cost: ", "Because replication uses transcoding-free copy (-c copy), a c6i.xlarge instance ($0.17/hour) handles 30 concurrent creators. The compute cost is negligible at ~$0.005 per streaming hour."),
        spacer(1),
        h2("10.5 Infrastructure Cost Summary (Per 1,000 Active Creators)"),
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
        h2("10.6 Cost Optimization Strategies for Engineers"),
        bullet("1. Enforce Target Bitrates: Lock the max ingest bitrate to 6 Mbps on the encoder to prevent unexpected bandwidth spike costs."),
        bullet("2. Circuit Breaker for Egress: If a destination platform drops, immediately disconnect the FFmpeg worker to cease unnecessary data transfer."),
        bullet("3. Dynamic Chat Polling: Slow down YouTube chat polling intervals during periods of low chat activity or when the creator minimizes their dashboard."),
        pageBreak(),

        // ─── SECTION 11: STRATEGIC STAKEHOLDER Q&A SCRIPTS ───
        sectionDivider("11", "Strategic Stakeholder Q&A Scripts"),
        spacer(1),
        h2("1. For the Chief Technology Officer (CTO)"),
        infoBox("Q: How does the system handle high-volume chat spikes during large streams without lagging the UI or crashing the backend?", [
          "Answer: \"We decouple chat ingestion from the dashboard UI using Apache Kafka and Redis. Incoming comments from platform adapters are pushed immediately to a Kafka topic. Workers consume this topic, normalize the messages, and write them to a Redis Stream database. The frontend connects to a WebSocket server that reads from the Redis stream. To protect the browser UI from rendering issues, we implement client-side batching: instead of rendering every message individually, the client buffers messages and updates the React state tree at a locked 100ms interval.\""
        ], "F9FAFB", "9CA3AF"),
        spacer(1),
        h2("2. For the Lead Architect"),
        infoBox("Q: Why are we using FFmpeg in node worker threads instead of running a full-scale media server for stream duplication?", [
          "Answer: \"A full-scale media server (like Wowza or custom WebRTC bridges) introduces significant resource overhead and license costs. Since our goal is simple RTMP replication (simulcasting) rather than video transcoding, we execute FFmpeg using the command line with -c copy. This skips decoding and re-encoding, preserving the source audio/video bits. This approach reduces latency to near-zero and permits a single AWS EC2 compute instance to handle up to 30 concurrent streams.\""
        ], "F9FAFB", "9CA3AF"),
        spacer(1),
        h2("3. For the Head of Product"),
        infoBox("Q: How do we prevent 'overselling' during flash live sales if two users comment buy at the exact same millisecond?", [
          "Answer: \"We implement a Redis-based distributed lock (Redlock) on product SKUs. When a 'comment-to-buy' intent is parsed, the order service attempts to acquire a lock for that product SKU in Redis before generating the Shopify draft order. If the lock is acquired, the inventory is temporarily decremented in our cache for a 15-minute window. If the user completes payment, the webhook confirms the sale and updates the primary catalog store. If the checkout window expires, the inventory auto-increments back into the pool.\""
        ], "F9FAFB", "9CA3AF"),
        spacer(1),
        h2("4. For Investors"),
        infoBox("Q: What is our primary competitive moat against platforms like Restream or Streamlabs?", [
          "Answer: \"While Restream and Streamlabs focus purely on video distribution and simple chat widgets, XIT Streamer bridges the gap between broadcasting and e-commerce. Our moat is our unified social commerce transaction layer. By integrating inventory systems directly with automated comment-to-buy DM checkouts, we transform livestreams from simple branding channels into high-converting sales machines. Additionally, our enterprise-grade agency governance and white-label client reporting features cater to high-value agencies rather than low-value prosumers.\""
        ], "F9FAFB", "9CA3AF"),
        pageBreak(),

        // ─── SECTION 12: END-TO-END USER JOURNEY WALKTHROUGH ───
        sectionDivider("12", "End-to-End User Journey Walkthrough"),
        spacer(1),
        para("To ground the technical architecture in user experience, here is the complete step-by-step workflow of a creator, Alex, using XIT Streamer to launch a live shopping event for his e-commerce brand."),
        spacer(1),
        h3("Scenario:"),
        bullet("The Host: Alex (fashion creator and owner of \"Alex Apparel\")."),
        bullet("The Product: \"Vibrant Gaming Chair\" ($189.99), catalog trigger code set to #chair."),
        bullet("The Channels: YouTube Live, Facebook Live, Instagram Live, and his custom web storefront."),
        spacer(1),
        h2("Step 1: Pre-Stream Setup & Integrations"),
        bulletBoldLead("User Action: ", "Alex logs into XIT Streamer. He goes to the Connections Center, clicks \"Connect\" on YouTube, Facebook, and Instagram, logs into his accounts, and authorizes permissions. Next, he navigates to the E-Commerce tab, enters his Shopify URL, installs the Shopify App extension, and sees his catalog automatically sync. He sets the purchase tag for his Gaming Chair to #chair."),
        bulletBoldLead("Under the Hood: ", "XIT's OAuth Service exchanges codes with Meta and Google APIs for long-lived access tokens, encrypting them using AES-256. The Commerce Sync Worker fetches product SKUs, images, and prices from Shopify GraphQL and stores a fast-read cache in Redis."),
        spacer(1),
        h2("Step 2: Event Scheduling & Selecting Ingest Method"),
        bulletBoldLead("User Action: ", "Alex creates a new live event: \"Summer Merch Drop & Flash Sale!\". He schedules it for 3 PM, toggles on all 4 destinations, and tags the \"Vibrant Gaming Chair.\" XIT presents Alex with three streaming source options: WebRTC Browser Studio, OBS Studio / External Software, and Mobile App Ingest. Alex chooses the WebRTC Browser Studio for this broadcast. He copies the provided HTML iframe script and embeds it on his site's blog."),
        bulletBoldLead("Under the Hood: ", "The Stream Service schedules live broadcasts on Meta and YouTube API endpoints and returns their ingestion keys. The backend initiates a HLS/WebRTC media mount point mapped to this stream ID to feed the website's iframe widget."),
        spacer(1),
        h2("Step 3: Going Live (Replication & Forwarding)"),
        bulletBoldLead("User Action: ", "At 3 PM, Alex clicks \"Go Live\" inside his XIT Browser Studio. His browser webcam turns on. Instantly, the dashboard shows \"Broadcasting to 4 Destinations,\" displaying real-time stream health (60 FPS, 5500 kbps)."),
        bulletBoldLead("Under the Hood: ", "The browser captures video/audio frames via HTML5 MediaStream APIs and sends them via WebRTC to XIT's gateway. The ingest gateway translates the WebRTC stream to RTMP, sending it to the SRS Ingest Server. SRS spawns a FFmpeg worker process that runs:"),
        codeBlock(`ffmpeg -i rtmp://localhost/live/alex_webrtc_in -c copy -f flv rtmp://youtube ... -c copy -f flv rtmp://facebook ...`),
        para("This duplicates the stream packets in memory and forwards them to YouTube, Facebook, and Instagram in parallel without re-encoding, utilizing near-zero CPU and saving Alex's home upload speed."),
        spacer(1),
        h2("Step 4: Activating the Live Sale (Comment-to-Buy Loop)"),
        bulletBoldLead("User Action: ", "Alex holds up the Gaming Chair on camera. He clicks the \"Spotlight Product\" button next to the chair card in his dashboard. A stylized graphic card slides onto his stream showing the price and text: \"Vibrant Gaming Chair - $189.99! Comment buy #chair to get your checkout link!\". Sarah (watching on YouTube) comments: buy #chair. Mike (watching on Instagram) comments: buy #chair."),
        bulletBoldLead("Under the Hood: ", "Spotlighting sends a WebSocket command to render the product visual card overlay onto the broadcast feeds. The Chat Aggregator gathers incoming messages via Meta Webhooks and YouTube chat polling APIs, normalization workers format them to JSON, and pushes them to Apache Kafka. The Regex Parser detects the #chair tag in the message content, requests a Redis Redlock to secure SKU inventory, and decrements stock in cache. DM dispatching: Meta Messenger API drops a direct message into Mike's Instagram inbox with a secure, pre-filled checkout cart URL. A public chat reply is posted to Sarah's YouTube thread instructing her to click the pinned link at the top of the chat page."),
        spacer(1),
        h2("Step 5: Checkout & In-Stream Social Proof"),
        bulletBoldLead("User Action: ", "Mike opens his DM on his phone, clicks the link, and completes the purchase. Instantly, Alex's dashboard updates the Gross Merchandise Value (GMV) counter to $189.99, a notification slides in: \"Mike J. just purchased a Gaming Chair!\", and a visual bubble overlays on-stream saying \"Sarah G. just bought a Gaming Chair!\" (social proof)."),
        bulletBoldLead("Under the Hood: ", "Stripe triggers a payment_intent.succeeded webhook post-payment. The Order Service marks the Shopify draft order as complete and clears the temporary inventory lock. A WebSocket event pushes a notification event to both the dashboard and the overlay graphics engine to display the purchase confirmation, driving further sales momentum.")
      ]
    }]
  });

  console.log("Packaging document buffer...");
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("XIT_STREAMER_Masterclass.docx", buffer);
  console.log("Document created successfully as XIT_STREAMER_Masterclass.docx");
}

main().catch((err) => {
  console.error("Critical error in main process:", err);
});
