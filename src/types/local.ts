export type EventStatus = "open" | "closed" | "settled" | "cancelled";

export type Profile = {
  id: string;
  username: string | null;
  balance: number;
  created_at: string;
};

export type Outcome = {
  id: string;
  event_id: string;
  label: string;
  sort_order: number;
};

export type Event = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  closes_at: string;
  status: EventStatus;
  winning_outcome_id: string | null;
  created_at: string;
  outcomes: Outcome[];
};

export type Bet = {
  id: string;
  user_id: string;
  event_id: string;
  outcome_id: string;
  amount: number;
  created_at: string;
};

