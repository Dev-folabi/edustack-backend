type ID = string;
// Enum for Gender
enum Gender {
  male = "male",
  female = "female",
  others = "others",
}

// School Request
export interface ISchoolRequest {
  name: string;
  email: string;
  phone: string[];
  address: string;
  isActive: boolean;
  adminId?: string;
}

// User Request
export interface IUserRequest {
  name?: string;
  email?: string;
  username: string;
  password: string;
  isSuperAdmin?: boolean;
}

// Student Request
export interface IStudentRequest extends IUserRequest {
  schoolId: ID;
  name: string;
  gender: Gender;
  dob: string;
  phone?: string;
  address: string;
  admission_date?: string;
  classId: string;
  sectionId: string;
  religion: string;
  blood_group?: string;
  father_name?: string;
  mother_name?: string;
  father_occupation?: string;
  mother_occupation?: string;
  isActive?: boolean;
  city: string;
  state: string;
  country: string;
  route_vehicle_id?: string;
  room_id?: ID;
  added_by?: ID;
  photo_url?: string;
  exist_guardian: boolean;
  guardian_name?: string;
  guardian_phone?: string[];
  guardian_email: string;
  guardian_username: string;
  guardian_password: string;
}

// Staff Request
export interface IStaffRequest extends IUserRequest {
  name: string;
  phone: string[];
  address: string;
  schoolId: ID;
  role: string;
  designation?: string;
  dob?: Date;
  salary?: number;
  joining_date?: Date;
  gender: Gender;
  photo_url?: string;
  isActive?: boolean;
  qualification?: string;
  notes?: string;
  classSectionId?: string;
}

// Parent Request
export interface IParentRequest {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  studentIds: ID[];
}

// UserSchool Request
export interface IUserSchoolRequest {
  userId: ID;
  schoolId: ID;
}

export interface TermRequest {
  id?: string;
  name: string;
  start_date: Date;
  end_date: Date;
  isActive: boolean;
}

export interface SessionRequest {
  name: string;
  start_date: Date;
  end_date: Date;
  isActive: boolean;
  terms: TermRequest[];
}

export interface classSchoolRequest {
  name: string;
  section: string;
  schoolId: string[];
  teacherId?: string;
}

export interface TransferStudentRequest {
  studentId: string[];
  fromSchoolId: string;
  toSchoolId: string;
  toClassId: string;
  toSectionId: string;
  transferReason?: string;
}

export interface EnrollStudentRequest {
  studentId: string;
  classId: string;
  sectionId: string;
}

export interface PromoteStudentRequest {
  studentId: string[];
  fromClassId: string;
  toClassId: string;
  sectionId: string;
  promoteSessionId: string;
  promoteTermId: string;
  promotedBy: string;
}

export interface CreateSubjectRequest {
  name: string;
  code?: string;
  isActive?: boolean;
  teacherId?: string;
  schoolIds: string[];
  sectionIds: string[];
}

export enum AttendanceStatus {
  PRESENT = "PRESENT",
  ABSENT = "ABSENT",
  LATE = "LATE",
  HOLIDAY = "HOLIDAY",
  ON_LEAVE = "ON_LEAVE",
}

export interface StudentAttendanceRequest {
  date: string;
  sectionId: string;
  subjectId?: string;
  records: {
    studentId: string;
    status: AttendanceStatus;
    notes?: string;
  }[];
}

export interface StaffAttendanceRequest {
  date: string;
  records: {
    staffId: string;
    status: AttendanceStatus;
    notes?: string;
  }[];
}