import React from "react";

import { Modal as UiModal } from "./ui";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: string | number;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, width = "min(960px, 92%)", children }) => (
  <UiModal open={isOpen} onClose={onClose} title={title} ariaLabel={title} width={width} closeOnOverlay={false} closeOnEscape={false}>
    {children}
  </UiModal>
);
