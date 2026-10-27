export type ApiUser = {
  studentId: string;
  name: string;
  roles: string[];
};

export type AdminSession = {
  _id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
};

export type RosterRecord = {
  attendanceId: string | null;
  studentId: string;
  name: string;
  roomNumber?: string | null;
  status: 'present' | 'absent';
  markedAt: string | null;
};

export type Attempt = {
  actorId: string;
  outcome: string;
  createdAt: string;
};

export type AdminReport = {
  records: RosterRecord[];
  attempts: Attempt[];
};
