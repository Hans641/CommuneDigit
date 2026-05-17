import React from 'react';
import {
  Home, FileText, User, Calendar, Bell, MapPin, CreditCard, Printer, AlertCircle, Settings, Zap, CheckCircle,
  BarChart2, LogIn, Download, Rocket, Users, Lock, Scale, Wrench
} from 'lucide-react';
import { Search, Clock, Mail, Phone, Paperclip, X, Circle } from 'lucide-react';

const ICON_MAP = {
  home: Home,
  file: FileText,
  user: User,
  calendar: Calendar,
  bell: Bell,
  pin: MapPin,
  card: CreditCard,
  printer: Printer,
  alert: AlertCircle,
  settings: Settings,
  zap: Zap,
  check: CheckCircle,
  chart: BarChart2,
  login: LogIn,
  download: Download,
  rocket: Rocket,
  users: Users,
  lock: Lock,
  scale: Scale,
  wrench: Wrench,
  search: Search,
  clock: Clock,
  mail: Mail,
  phone: Phone,
  paperclip: Paperclip,
  x: X,
  circle: Circle,
};

export default function Icon({ name, size = 18, className = '', strokeWidth = 1.5 }) {
  const Cmp = ICON_MAP[name];
  if (!Cmp) return <span className={className} style={{ fontSize: size }}>•</span>;
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} />;
}
