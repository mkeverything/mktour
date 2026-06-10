'use client';

import type { ComponentProps } from 'react';

import useComboModal from '@/components/hooks/use-combo-modal';

type ComboModalComponents = ReturnType<typeof useComboModal>;

type RootProps = ComponentProps<ComboModalComponents['Root']>;
type TriggerProps = ComponentProps<ComboModalComponents['Trigger']>;
type ContentProps = ComponentProps<ComboModalComponents['Content']>;
type HeaderProps = ComponentProps<ComboModalComponents['Header']>;
type TitleProps = ComponentProps<ComboModalComponents['Title']>;
type DescriptionProps = ComponentProps<ComboModalComponents['Description']>;
type FooterProps = ComponentProps<ComboModalComponents['Footer']>;
type CloseProps = ComponentProps<ComboModalComponents['Close']>;

function Root(props: RootProps) {
  const ComboModal = useComboModal();

  return <ComboModal.Root {...props} />;
}

function Trigger(props: TriggerProps) {
  const ComboModal = useComboModal();

  return <ComboModal.Trigger {...props} />;
}

function Content(props: ContentProps) {
  const ComboModal = useComboModal();

  return <ComboModal.Content {...props} />;
}

function Header(props: HeaderProps) {
  const ComboModal = useComboModal();

  return <ComboModal.Header {...props} />;
}

function Title(props: TitleProps) {
  const ComboModal = useComboModal();

  return <ComboModal.Title {...props} />;
}

function Description(props: DescriptionProps) {
  const ComboModal = useComboModal();

  return <ComboModal.Description {...props} />;
}

function Footer(props: FooterProps) {
  const ComboModal = useComboModal();

  return <ComboModal.Footer {...props} />;
}

function Close(props: CloseProps) {
  const ComboModal = useComboModal();

  return <ComboModal.Close {...props} />;
}

const ComboModal = {
  Root,
  Trigger,
  Content,
  Header,
  Title,
  Description,
  Footer,
  Close,
};

export { Root, Trigger, Content, Header, Title, Description, Footer, Close };
export default ComboModal;
