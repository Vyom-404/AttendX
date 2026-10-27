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
