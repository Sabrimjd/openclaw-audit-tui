import { colors } from "../constants/colors";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbBarProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbBar({ items }: BreadcrumbBarProps) {
  if (items.length === 0) return null;

  return (
    <box
      flexDirection="row"
      height={1}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={colors.tableHeaderBg}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <box key={`${item.label}-${index}`} flexDirection="row">
            <text onMouseDown={item.onClick}>
              <span fg={isLast ? colors.textPrimary : colors.textMuted}>{item.label}</span>
            </text>
            {!isLast && <text><span fg={colors.textDim}> / </span></text>}
          </box>
        );
      })}
    </box>
  );
}
