
import React, { ReactNode } from "react";

interface DocSectionProps {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}

const DocSection: React.FC<DocSectionProps> = ({ id, title, children, className = "mb-16" }) => {
  return (
    <div id={id} className={className}>
      <h2 className="text-3xl font-bold mb-6">{title}</h2>
      {children}
    </div>
  );
};

export default DocSection;
