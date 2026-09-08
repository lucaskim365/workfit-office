import {
  FileText,
  CalendarDays,
  CreditCard,
  ShoppingCart,
  ClipboardList,
  BarChart3,
  FileSignature,
} from 'lucide-react';

interface DocTypeIconProps {
  type?: string;
  className?: string;
  size?: number;
}

export function DocTypeIcon({ type, className = 'text-ink3 shrink-0', size = 15 }: DocTypeIconProps) {
  switch (type) {
    case '휴가':
      return <CalendarDays size={size} className={className} />;
    case '지출':
    case '지출결의':
      return <CreditCard size={size} className={className} />;
    case '구매':
      return <ShoppingCart size={size} className={className} />;
    case '품의':
      return <ClipboardList size={size} className={className} />;
    case '업무보고':
      return <BarChart3 size={size} className={className} />;
    case '기안':
      return <FileSignature size={size} className={className} />;
    case '일반':
    default:
      return <FileText size={size} className={className} />;
  }
}
