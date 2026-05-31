export type ContactRole = "buyer" | "seller" | "both";

export type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  emails: string[];
  phones: string[];
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  role: ContactRole | null;
  source: string | null;
  birthday: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Tag = { id: string; name: string; color: string };

export type Transaction = {
  id: string;
  contact_id: string | null;
  client_name: string;
  address: string | null;
  closed_date: string | null;
  source_of_business: string | null;
  deal_type: "buyer" | "seller" | null;
  sold_price: number | null;
  commission_pct: number | null;
  gci: number | null;
  broker_share: number | null;
  admin_fee: number | null;
  agent_share: number | null;
  notes: string | null;
  created_at: string;
};

export type SegmentCriteria = {
  role?: ContactRole | "";
  city?: string;
  zip?: string;
  state?: string;
  tag_id?: string;
  has_email?: boolean;
  has_phone?: boolean;
  search?: string;
};

export type Segment = {
  id: string;
  name: string;
  description: string | null;
  criteria: SegmentCriteria;
  created_at: string;
};

export type Campaign = {
  id: string;
  name: string;
  kind: "postcard" | "card" | "mailer" | "other";
  segment_id: string | null;
  scheduled_date: string | null;
  status: "planned" | "in_progress" | "done";
  notes: string | null;
  created_at: string;
};

export type Reminder = {
  id: string;
  title: string;
  due_date: string;
  kind: "follow_up" | "anniversary" | "birthday" | "task";
  contact_id: string | null;
  transaction_id: string | null;
  recurrence: "none" | "annual";
  is_done: boolean;
  completed_at: string | null;
  completed_by: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
};

export type HomeValuation = {
  id: string;
  contact_id: string;
  address: string;
  estimate: number | null;
  range_low: number | null;
  range_high: number | null;
  source: string;
  queried_at: string;
  queried_by: string | null;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: "admin" | "member";
  created_at: string;
};
