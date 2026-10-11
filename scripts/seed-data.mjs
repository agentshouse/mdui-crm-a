#!/usr/bin/env node
/**
 * Legacy hand-authored regression fixtures, retained as historical evidence only.
 * Do not use for new Room population; use donor-seed-data.mjs instead.
 * This script only prints a change set;
 * importing it or running it never creates a Room or writes to the network.
 *
 * Usage: node scripts/seed-data.mjs --room atomic-crm-port
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const resourceTypes = {
  companies: "crm_company",
  contacts: "crm_contact",
  deals: "crm_deal",
  tasks: "crm_task",
  contact_notes: "crm_contact_note",
  deal_notes: "crm_deal_note",
  sales: "crm_sale",
  tags: "crm_tag",
  configuration: "crm_configuration",
};

const timestamp = (date, time = "10:00") => `${date}T${time}:00.000Z`;
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const sales = [
  {
    id: "studio-team",
    first_name: "Studio",
    last_name: "Team",
    email: "studio@northstar-studio.example",
    secondary_emails: [],
    administrator: false,
    disabled: false,
  },
  {
    id: "partnerships-team",
    first_name: "Partnerships",
    last_name: "Team",
    email: "partnerships@northstar-studio.example",
    secondary_emails: [],
    administrator: false,
    disabled: false,
  },
  {
    id: "client-success-team",
    first_name: "Client Success",
    last_name: "Team",
    email: "clients@northstar-studio.example",
    secondary_emails: [],
    administrator: false,
    disabled: false,
  },
];

const companyDetails = [
  [
    "juniper-thread",
    "Juniper & Thread",
    "consumer-discretionary",
    50,
    "Portland",
    "OR",
    "97205",
    "180 Sample Lane",
    "18000000",
    "studio-team",
    "Sustainable home-textile brand preparing a direct-to-consumer relaunch. Needs an editorial identity and a more useful wholesale catalog.",
  ],
  [
    "lumen-orchard",
    "Lumen Orchard",
    "information-technology",
    50,
    "Austin",
    "TX",
    "78701",
    "42 Example Avenue",
    "12000000",
    "partnerships-team",
    "B2B software company helping regional food suppliers forecast demand. Marketing and product teams are aligning on a clearer enterprise story.",
  ],
  [
    "harbor-kite",
    "Harbor Kite Hotels",
    "consumer-discretionary",
    250,
    "Seattle",
    "WA",
    "98101",
    "75 Demonstration Way",
    "46000000",
    "studio-team",
    "Independent hospitality group opening two boutique properties. Looking for an accessible booking website and a reusable launch campaign system.",
  ],
  [
    "moss-circuit",
    "Moss Circuit",
    "industrials",
    50,
    "Denver",
    "CO",
    "80202",
    "91 Sample Street",
    "22000000",
    "partnerships-team",
    "Commercial energy-monitoring hardware maker. Needs better installer-facing materials and a simpler product demonstration for facilities teams.",
  ],
  [
    "aster-table",
    "Aster Table Foods",
    "consumer-staples",
    250,
    "Chicago",
    "IL",
    "60601",
    "16 Example Court",
    "58000000",
    "client-success-team",
    "Specialty pantry-food producer expanding into regional grocery chains. An existing client for seasonal packaging and trade-show collateral.",
  ],
  [
    "sable-current",
    "Sable Current",
    "communication-services",
    10,
    "Brooklyn",
    "NY",
    "11201",
    "36 Demonstration Place",
    "4500000",
    "studio-team",
    "Independent audio-production studio seeking a distinctive portfolio site and a sharper pitch to documentary and branded-content clients.",
  ],
  [
    "cedar-form",
    "Cedar Form Workspace",
    "real-estate",
    50,
    "Minneapolis",
    "MN",
    "55401",
    "28 Sample Terrace",
    "16000000",
    "client-success-team",
    "Flexible-workspace operator refreshing member onboarding and the leasing experience across three neighborhood locations.",
  ],
  [
    "solstice-field",
    "Solstice Field",
    "consumer-discretionary",
    10,
    "Burlington",
    "VT",
    "05401",
    "63 Example Drive",
    "6200000",
    "partnerships-team",
    "Outdoor-equipment startup bringing repairable daypacks to independent retailers. Planning a measured launch with distributor-led demand testing.",
  ],
];

const companies = companyDetails.map(
  (
    [
      id,
      name,
      sector,
      size,
      city,
      state_abbr,
      zipcode,
      address,
      revenue,
      sales_id,
      description,
    ],
    index,
  ) => ({
    id,
    name,
    logo: {},
    sector,
    size,
    website: `https://${id}.example`,
    phone_number: `+1 202-555-01${String(10 + index).padStart(2, "0")}`,
    address,
    zipcode,
    city,
    state_abbr,
    sales_id,
    created_at: timestamp(`2026-09-${String(2 + index * 2).padStart(2, "0")}`),
    description,
    revenue,
    country: "United States",
    context_links: [`https://${id}.example/about`],
  }),
);

const contactDetails = [
  [
    "Maya",
    "Ellery",
    "Head of Brand",
    "hot",
    "Owns the retail relaunch brief. Prefers concise options with production estimates included.",
  ],
  [
    "Theo",
    "Marwood",
    "Ecommerce Director",
    "warm",
    "Leading the storefront migration and measuring conversion by device. Wants accessibility considered from the start.",
  ],
  [
    "Isla",
    "Perrin",
    "Wholesale Manager",
    "in-contract",
    "Coordinates retailer feedback and the seasonal catalog. A reliable point of contact for print specifications.",
  ],
  [
    "Nora",
    "Vellum",
    "VP of Marketing",
    "hot",
    "Executive sponsor for enterprise positioning. Looking for a story that works equally well in a sales deck and on the website.",
  ],
  [
    "Evan",
    "Sorrell",
    "Product Design Lead",
    "warm",
    "Can supply product workflows and customer research. Interested in a small prototype before committing to a full redesign.",
  ],
  [
    "Leila",
    "Harrow",
    "Partnerships Director",
    "cold",
    "Met through a regional supplier event. Evaluating partner-marketing support for next quarter.",
  ],
  [
    "Rafael",
    "Cairn",
    "Marketing Director",
    "hot",
    "Responsible for both property launches. Needs clear division between the booking build and campaign deliverables.",
  ],
  [
    "Amara",
    "Whitcombe",
    "Guest Experience Lead",
    "warm",
    "Collecting guest questions to simplify booking and arrival information. Can arrange a staff research session.",
  ],
  [
    "Noah",
    "Bellward",
    "Finance Director",
    "cold",
    "Reviews phased budgets and vendor terms. Asked for maintenance costs to be visible in the proposal.",
  ],
  [
    "Priya",
    "Marden",
    "Commercial Director",
    "warm",
    "Interested in a short explainer for facilities buyers. Wants installation benefits demonstrated without technical jargon.",
  ],
  [
    "Felix",
    "Thornby",
    "Product Marketing Manager",
    "hot",
    "Owns launch collateral and installer training. Has a usable archive of product photography and field interviews.",
  ],
  [
    "Ada",
    "Wrenley",
    "Channel Manager",
    "cold",
    "Testing demand with two distribution partners. A potential sponsor for a co-branded sales toolkit.",
  ],
  [
    "Sofia",
    "Aldermere",
    "Brand Director",
    "in-contract",
    "Long-standing studio contact. Approved the first packaging system and is coordinating the next seasonal rollout.",
  ],
  [
    "Jonah",
    "Beckett",
    "Trade Marketing Lead",
    "warm",
    "Manages grocery buyer presentations and trade shows. Appreciates reusable templates that a small team can maintain.",
  ],
  [
    "Mina",
    "Calderwood",
    "Packaging Manager",
    "in-contract",
    "Owns dielines and supplier handoff. Wants all materials reviewed together to avoid inconsistent print finishes.",
  ],
  [
    "Oliver",
    "Fenwick",
    "Co-founder",
    "hot",
    "Creative sponsor for the portfolio refresh. Wants sound and motion to support the work without slowing the experience.",
  ],
  [
    "Dalia",
    "Westhaven",
    "Executive Producer",
    "warm",
    "Has prepared a shortlist of launch case studies. Can confirm rights and credits for every featured project.",
  ],
  [
    "Ivo",
    "Sandwell",
    "Business Development Lead",
    "cold",
    "Following up on branded-content introductions. Still clarifying how the studio should describe its commercial offering.",
  ],
  [
    "Clara",
    "Ashbourne",
    "Member Experience Director",
    "in-contract",
    "Owner of the member welcome program. Measures success by fewer support requests in the first two weeks.",
  ],
  [
    "Arun",
    "Hollis",
    "Leasing Director",
    "warm",
    "Wants location pages that distinguish the neighborhoods while retaining a consistent visual system.",
  ],
  [
    "Zoe",
    "Fairholt",
    "Community Manager",
    "warm",
    "Collects practical member feedback. Can pilot onboarding emails with the next group of new members.",
  ],
  [
    "Miles",
    "Everden",
    "Founder",
    "warm",
    "Taking a cautious launch approach. Needs a clear retailer presentation before deciding on a wider campaign.",
  ],
  [
    "Tessa",
    "Bramwell",
    "Independent Brand Consultant",
    "cold",
    "Independent referral partner exploring outdoor and lifestyle projects. No company relationship has been assigned yet.",
  ],
  [
    "Leon",
    "Hartmere",
    "Retail Partnerships Lead",
    "warm",
    "Introduced after a buyer preview. Waiting for a studio team to own the follow-up about distributor launch assets.",
  ],
];

const contacts = contactDetails.map(
  ([first_name, last_name, title, status, background], index) => {
    const company = companies[Math.floor(index / 3)];
    const independent = index === 22;
    return {
      id: slug(`${first_name}-${last_name}`),
      first_name,
      last_name,
      title,
      ...(independent ? {} : { company_id: company.id }),
      email_jsonb: [
        {
          email: `${first_name.toLowerCase()}.${last_name.toLowerCase()}@${independent ? "bramwell-consulting" : company.id}.example`,
          type: "Work",
        },
      ],
      phone_jsonb: [
        {
          number: `+1 202-555-01${String(30 + index).padStart(2, "0")}`,
          type: "Work",
        },
      ],
      first_seen: timestamp(`2026-09-${String(4 + index).padStart(2, "0")}`),
      last_seen: timestamp(
        `2026-10-${String(1 + (index % 10)).padStart(2, "0")}`,
        index % 2 ? "15:30" : "09:00",
      ),
      has_newsletter: index % 4 === 0,
      tags:
        index % 5 === 0
          ? ["priority", "referral"]
          : index % 3 === 0
            ? ["priority"]
            : index % 4 === 0
              ? ["referral"]
              : [],
      ...(index === 22 || index === 23 ? {} : { sales_id: company.sales_id }),
      status,
      background,
    };
  },
);

const dealDetails = [
  [
    "juniper-storefront",
    "Juniper retail storefront",
    0,
    "website-design",
    "proposal-sent",
    48000,
    "2026-10-22",
    "Accessible storefront design, editorial product pages, and a practical component library for the ecommerce team.",
  ],
  [
    "juniper-wholesale",
    "Juniper wholesale catalog",
    0,
    "print-project",
    "won",
    12500,
    "2026-10-06",
    "Forty-page wholesale catalog with retailer ordering guidance and production-ready print artwork.",
  ],
  [
    "lumen-enterprise",
    "Lumen enterprise story",
    1,
    "copywriting",
    "in-negociation",
    26000,
    "2026-10-20",
    "Messaging workshops, an enterprise sales narrative, and revised copy for six core website pages.",
  ],
  [
    "lumen-dashboard",
    "Lumen buyer dashboard",
    1,
    "ui-design",
    "opportunity",
    64000,
    "2026-11-18",
    "Discovery and interface design for a demand-planning dashboard, starting with a focused research sprint.",
  ],
  [
    "harbor-booking",
    "Harbor Kite booking experience",
    2,
    "website-design",
    "in-negociation",
    82000,
    "2026-10-28",
    "A shared website and booking design system for the existing hotels and two upcoming property launches.",
  ],
  [
    "harbor-opening",
    "Harbor Kite opening campaign",
    2,
    "other",
    "proposal-sent",
    34000,
    "2026-11-02",
    "Launch campaign concept, art direction, and a reusable set of paid and organic social templates.",
  ],
  [
    "moss-explainer",
    "Moss Circuit product explainer",
    3,
    "other",
    "opportunity",
    18500,
    "2026-11-12",
    "A concise product story and motion storyboard demonstrating benefits for commercial facilities teams.",
  ],
  [
    "moss-installer",
    "Moss installer toolkit",
    3,
    "print-project",
    "delayed",
    14500,
    "2026-12-03",
    "Installer quick-start cards and distributor presentation templates. Waiting for the hardware launch schedule.",
  ],
  [
    "aster-seasonal",
    "Aster seasonal packaging",
    4,
    "print-project",
    "won",
    31500,
    "2026-10-02",
    "An adaptable seasonal packaging system covering six pantry products and a coordinated retail display.",
  ],
  [
    "aster-tradeshow",
    "Aster grocery-buyer presentation",
    4,
    "copywriting",
    "proposal-sent",
    9800,
    "2026-10-16",
    "A refreshed buyer presentation with a clear assortment story, proof points, and editable sales templates.",
  ],
  [
    "sable-portfolio",
    "Sable Current portfolio",
    5,
    "website-design",
    "opportunity",
    28500,
    "2026-11-09",
    "A fast, sound-led portfolio experience with flexible case studies and straightforward content publishing.",
  ],
  [
    "sable-pitch",
    "Sable branded-content pitch",
    5,
    "copywriting",
    "lost",
    7600,
    "2026-10-07",
    "A modular capabilities deck and outreach story. The prospect chose to use an existing internal template.",
  ],
  [
    "cedar-onboarding",
    "Cedar Form member welcome",
    6,
    "ui-design",
    "won",
    22000,
    "2026-09-29",
    "Member onboarding flows, welcome emails, and an approachable self-serve guide to each workspace.",
  ],
  [
    "cedar-leasing",
    "Cedar Form leasing pages",
    6,
    "website-design",
    "in-negociation",
    36500,
    "2026-10-30",
    "Location landing pages and an enquiry flow connecting prospective members with the right neighborhood workspace.",
  ],
  [
    "solstice-retailer",
    "Solstice Field retailer launch",
    7,
    "print-project",
    "opportunity",
    16500,
    "2026-11-20",
    "Retailer launch materials focused on repairability, merchandising, and the initial daypack assortment.",
  ],
  [
    "solstice-brand",
    "Solstice Field launch identity",
    7,
    "other",
    "delayed",
    42000,
    "2027-01-15",
    "A broader launch identity and campaign system. Paused until the initial distributor demand test is complete.",
  ],
];

const stageIndexes = {};
const deals = dealDetails.map(
  (
    [id, name, companyIndex, category, stage, amount, closing, description],
    index,
  ) => {
    const company = companies[companyIndex];
    const stageIndex = stageIndexes[stage] ?? 0;
    stageIndexes[stage] = stageIndex + 1;
    return {
      id,
      name,
      company_id: company.id,
      contact_ids: [
        contacts[companyIndex * 3].id,
        ...(companyIndex === 7 ? [] : [contacts[companyIndex * 3 + 1].id]),
      ],
      category,
      stage,
      description,
      amount,
      created_at: timestamp(`2026-09-${String(10 + index).padStart(2, "0")}`),
      updated_at: timestamp(
        `2026-10-${String(1 + (index % 10)).padStart(2, "0")}`,
      ),
      expected_closing_date: timestamp(closing, "17:00"),
      sales_id: company.sales_id,
      index: stageIndex,
    };
  },
);

const taskDetails = [
  [
    "juniper-scope",
    0,
    "email",
    "Send the revised storefront scope with accessibility and content handoff included.",
    "2026-10-09",
    "09:00",
  ],
  [
    "lumen-budget",
    3,
    "call",
    "Confirm the enterprise messaging budget and the two remaining approval questions.",
    "2026-10-10",
    "14:00",
  ],
  [
    "harbor-agenda",
    6,
    "meeting",
    "Prepare the booking workshop agenda and separate the launch-campaign decisions.",
    "2026-10-11",
    "15:00",
  ],
  [
    "moss-demo",
    10,
    "demo",
    "Walk through the product explainer outline with the marketing team.",
    "2026-10-12",
    "16:00",
  ],
  [
    "aster-buyer",
    13,
    "follow-up",
    "Ask for the grocery-buyer deck feedback before finalizing the estimate.",
    "2026-10-13",
    "11:00",
  ],
  [
    "sable-case-studies",
    16,
    "email",
    "Request approved audio clips and the final shortlist of portfolio case studies.",
    "2026-10-14",
    "10:00",
  ],
  [
    "cedar-leasing",
    19,
    "call",
    "Review neighborhood page priorities and confirm the leasing enquiry owner.",
    "2026-10-15",
    "13:30",
  ],
  [
    "solstice-pilot",
    21,
    "follow-up",
    "Check retailer pilot results before recommending the launch-materials scope.",
    "2026-10-16",
    "09:30",
  ],
  [
    "juniper-proof",
    2,
    "ship",
    "Deliver the approved wholesale catalog print files to the client.",
    "2026-10-05",
    "16:00",
    "2026-10-05",
  ],
  [
    "aster-production",
    14,
    "meeting",
    "Review the packaging supplier checklist and close production questions.",
    "2026-10-06",
    "14:00",
    "2026-10-06",
  ],
  [
    "cedar-thanks",
    18,
    "thank-you",
    "Thank the member team for testing the welcome flow and summarize changes.",
    "2026-10-08",
    "11:00",
    "2026-10-08",
  ],
  [
    "sable-close",
    17,
    "email",
    "Close out the pitch-deck opportunity and keep the portfolio conversation open.",
    "2026-10-09",
    "15:00",
    "2026-10-09",
  ],
  [
    "harbor-costs",
    8,
    "email",
    "Share the phased maintenance-cost breakdown for the booking proposal.",
    "2026-10-19",
    "10:00",
  ],
  [
    "moss-timing",
    11,
    "follow-up",
    "Confirm whether the installer toolkit can restart after the hardware milestone.",
    "2026-10-23",
    "14:00",
  ],
  [
    "tessa-intro",
    22,
    "lunch",
    "Discuss possible lifestyle-brand referrals with the independent consultant.",
    "2026-10-20",
    "12:00",
  ],
  [
    "leon-intake",
    23,
    "none",
    "Assign a studio team and capture the distributor launch-asset requirements.",
    "2026-10-12",
    "09:00",
  ],
];

const tasks = taskDetails.map(
  ([id, contactIndex, type, text, date, time, done]) => ({
    id,
    contact_id: contacts[contactIndex].id,
    type,
    text,
    due_date: timestamp(date, time),
    ...(done ? { done_date: timestamp(done, "17:00") } : {}),
    ...(contacts[contactIndex].sales_id
      ? { sales_id: contacts[contactIndex].sales_id }
      : {}),
  }),
);

const contactNoteDetails = [
  [
    "maya-relaunch",
    0,
    "2026-10-10",
    "hot",
    "Maya confirmed the relaunch should prioritize product storytelling and a simpler wholesale path. The proposal needs a separate line for content migration.",
  ],
  [
    "theo-accessibility",
    1,
    "2026-10-07",
    "warm",
    "Theo shared the storefront pain points: inconsistent mobile product pages and confusing size information. An accessibility review should be part of discovery.",
  ],
  [
    "nora-positioning",
    3,
    "2026-10-09",
    "hot",
    "The leadership team agrees on the enterprise audience. Nora wants two contrasting story directions before approving the final copywriting scope.",
  ],
  [
    "evan-prototype",
    4,
    "2026-10-06",
    "warm",
    "Evan can provide anonymized workflow examples and arrange product-team interviews. Suggested starting with one buyer dashboard rather than the entire suite.",
  ],
  [
    "rafael-launch",
    6,
    "2026-10-08",
    "hot",
    "Rafael confirmed that booking and campaign budgets have different approvers. Keep those scopes distinct even when the visual direction is shared.",
  ],
  [
    "amara-research",
    7,
    "2026-10-05",
    "warm",
    "The guest-services team is available for a one-hour research session. Arrival questions and accessible room information should be visible before booking.",
  ],
  [
    "felix-explainer",
    10,
    "2026-10-10",
    "hot",
    "Felix has product footage ready. The first story should explain the facilities manager's day-to-day benefit before describing the underlying sensors.",
  ],
  [
    "sofia-packaging",
    12,
    "2026-10-02",
    "in-contract",
    "Seasonal packaging direction approved. Sofia asked for a simple extension guide so the next product launch can use the same system.",
  ],
  [
    "oliver-portfolio",
    15,
    "2026-10-09",
    "hot",
    "Oliver prefers a quiet portfolio with strong case-study storytelling. Audio should be user-controlled, and page speed is a non-negotiable acceptance criterion.",
  ],
  [
    "clara-pilot",
    18,
    "2026-10-08",
    "in-contract",
    "The onboarding pilot received useful staff feedback. Clara approved the revised welcome sequence and will collect member questions during the first two weeks.",
  ],
  [
    "miles-retailers",
    21,
    "2026-10-06",
    "warm",
    "Miles is testing demand with a small retailer group. The first proposal should focus on the buyer presentation and shelf-ready product information.",
  ],
  [
    "tessa-referrals",
    22,
    "2026-10-03",
    "cold",
    "Tessa is an independent consultant, not an employee of a tracked company. She offered to compare notes on suitable lifestyle clients after the studio introduction.",
  ],
];

const contact_notes = contactNoteDetails.map(
  ([id, contactIndex, date, status, text]) => ({
    id,
    contact_id: contacts[contactIndex].id,
    text,
    date: timestamp(date, "16:30"),
    sales_id: contacts[contactIndex].sales_id ?? "partnerships-team",
    status,
    attachments: [],
  }),
);

const dealNoteDetails = [
  [
    "juniper-proposal-review",
    "juniper-storefront",
    "2026-10-10",
    "The client requested a clearer content-migration allowance. Keep the overall estimate at $48,000 and make assumptions visible in the revised proposal.",
  ],
  [
    "lumen-approval-path",
    "lumen-enterprise",
    "2026-10-09",
    "Marketing is aligned on scope. Remaining negotiation covers the number of leadership review rounds and the handoff format for the sales team.",
  ],
  [
    "harbor-phasing",
    "harbor-booking",
    "2026-10-08",
    "Proposed two phases: shared booking foundations first, followed by the new property pages. Maintenance pricing is being reviewed separately.",
  ],
  [
    "aster-handoff",
    "aster-seasonal",
    "2026-10-02",
    "The seasonal packaging scope is approved. Production handoff includes editable source files, print specifications, and a concise extension guide.",
  ],
  [
    "sable-outcome",
    "sable-pitch",
    "2026-10-07",
    "Closed as lost because the client chose an internal presentation template. The website opportunity remains active and should be discussed separately.",
  ],
  [
    "solstice-dependency",
    "solstice-brand",
    "2026-10-06",
    "Paused pending the distributor demand test. Revisit after retailer feedback; avoid scheduling a full identity sprint until the launch budget is confirmed.",
  ],
];

const deal_notes = dealNoteDetails.map(([id, deal_id, date, text]) => ({
  id,
  deal_id,
  text,
  date: timestamp(date, "17:30"),
  sales_id: deals.find((deal) => deal.id === deal_id).sales_id,
  attachments: [],
}));

const configuration = [
  {
    id: "1",
    config: {
      title: "Northstar Studio · sample CRM",
      currency: "USD",
      companySectors: [
        { value: "communication-services", label: "Communication Services" },
        { value: "consumer-discretionary", label: "Consumer Discretionary" },
        { value: "consumer-staples", label: "Consumer Staples" },
        { value: "energy", label: "Energy" },
        { value: "financials", label: "Financials" },
        { value: "health-care", label: "Health Care" },
        { value: "industrials", label: "Industrials" },
        { value: "information-technology", label: "Information Technology" },
        { value: "materials", label: "Materials" },
        { value: "real-estate", label: "Real Estate" },
        { value: "utilities", label: "Utilities" },
      ],
      dealStages: [
        { value: "opportunity", label: "Opportunity" },
        { value: "proposal-sent", label: "Proposal Sent" },
        { value: "in-negociation", label: "In Negotiation" },
        { value: "won", label: "Won" },
        { value: "lost", label: "Lost" },
        { value: "delayed", label: "Delayed" },
      ],
      dealPipelineStatuses: ["won"],
      dealCategories: [
        { value: "other", label: "Other" },
        { value: "copywriting", label: "Copywriting" },
        { value: "print-project", label: "Print project" },
        { value: "ui-design", label: "UI Design" },
        { value: "website-design", label: "Website design" },
      ],
      noteStatuses: [
        { value: "cold", label: "Cold", color: "#7dbde8" },
        { value: "warm", label: "Warm", color: "#e8cb7d" },
        { value: "hot", label: "Hot", color: "#e88b7d" },
        { value: "in-contract", label: "In Contract", color: "#a4e87d" },
      ],
      taskTypes: [
        { value: "none", label: "None" },
        { value: "email", label: "Email" },
        { value: "demo", label: "Demo" },
        { value: "lunch", label: "Lunch" },
        { value: "meeting", label: "Meeting" },
        { value: "follow-up", label: "Follow-up" },
        { value: "thank-you", label: "Thank you" },
        { value: "ship", label: "Ship" },
        { value: "call", label: "Call" },
      ],
    },
  },
];

/** Native donor-shaped records. Complex fields are encoded at the file boundary. */
export const seedRecords = {
  companies,
  contacts,
  deals,
  tasks,
  contact_notes,
  deal_notes,
  sales,
  tags: [
    { id: "priority", name: "Priority", color: "#E88B7D" },
    { id: "referral", name: "Referral", color: "#7DBDE8" },
  ],
  configuration,
};

/** Keep all frontmatter values primitive; JSON text stays under its donor key. */
export function serializeSeedRecord(resource, record) {
  const type = resourceTypes[resource];
  if (!type) throw new Error(`Unknown CRM resource: ${resource}`);
  // Markdown reserves `type` for its document kind. Only the donor task subtype
  // needs an alias; every other field retains its exact donor name.
  const fields = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      resource === "tasks" && key === "type" ? "task_type" : key,
      value,
    ]),
  );
  const metadata = { type, ...fields };
  const frontmatter = Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      const primitive =
        typeof value === "boolean"
          ? String(value)
          : typeof value === "object"
            ? JSON.stringify(value)
            : value;
      return `${key}: ${JSON.stringify(primitive)}`;
    })
    .join("\n");
  const title =
    record.name ??
    ([record.first_name, record.last_name].filter(Boolean).join(" ") ||
      record.id);
  const detail = record.description ?? record.text ?? record.background ?? "";
  return `---\n${frontmatter}\n---\n\n# ${title}\n\n${detail ? `${detail}\n\n` : ""}Synthetic demonstration data. Names, organizations, contact details, and opportunities are fictional.\n`;
}

/** Builds one schema change and exactly 88 document changes without publishing. */
export function buildSeedChanges(room = "atomic-crm-port") {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(room)) {
    throw new Error("Room must be a lowercase, hyphen-separated slug.");
  }
  const changes = [
    {
      op: "create",
      path: `/rooms/${room}/settings/schema.yaml`,
      content: readFileSync(new URL("../schema.yaml", import.meta.url), "utf8"),
    },
  ];
  for (const [resource, records] of Object.entries(seedRecords)) {
    for (const record of records) {
      changes.push({
        op: "create",
        path: `/rooms/${room}/crm/${resource}/${record.id}.md`,
        content: serializeSeedRecord(resource, record),
      });
    }
  }
  return { changes };
}

function main(args) {
  let room = "atomic-crm-port";
  if (args.length) {
    if (args.length === 2 && args[0] === "--room") room = args[1];
    else if (args.length === 1 && args[0].startsWith("--room="))
      room = args[0].slice(7);
    else throw new Error("Usage: node scripts/seed-data.mjs [--room slug]");
  }
  process.stdout.write(`${JSON.stringify(buildSeedChanges(room), null, 2)}\n`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}
