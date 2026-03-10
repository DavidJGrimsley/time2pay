import { createElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { footerBrand, type LandingFooterLink } from '../../content/landing-content';
import { SemanticText, SemanticView } from './semantic-elements';

type LandingFooterProps = {
  links: LandingFooterLink[];
  onOpenLink: (href: string) => void;
};

function FooterLinkButton({
  href,
  label,
  onOpenLink,
  isPrimary = false,
}: {
  href: string;
  label: string;
  onOpenLink: (href: string) => void;
  isPrimary?: boolean;
}) {
  const className = isPrimary
    ? 'inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-heading no-underline'
    : 'inline-flex items-center justify-center rounded-full border border-white px-4 py-2 text-sm font-semibold text-white no-underline';

  if (process.env.EXPO_OS === 'web') {
    return createElement(
      'a',
      {
        className,
        href,
        rel: 'noopener noreferrer',
        target: '_blank',
      },
      label,
    );
  }

  return (
    <Pressable
      className={isPrimary ? 'rounded-full bg-white px-4 py-2' : 'rounded-full border border-white px-4 py-2'}
      style={{ opacity: 0.92 }}
      onPress={() => onOpenLink(href)}
    >
      <Text className={isPrimary ? 'text-sm font-semibold text-heading' : 'text-sm font-semibold text-white'}>
        {label}
      </Text>
    </Pressable>
  );
}

export function LandingFooter({ links, onOpenLink }: LandingFooterProps) {
  return (
    <SemanticView as="footer" className="w-full border-t border-border bg-black">
      <View
        className="mx-auto w-full flex-col gap-6 px-6 py-12 md:flex-row md:items-end md:justify-between md:px-8"
        style={{ maxWidth: 1120 }}
      >
        <View className="max-w-xl gap-3">
          <SemanticText as="p" className="text-xs font-bold uppercase tracking-[2px] text-white" style={{ opacity: 0.72 }}>
            Built by
          </SemanticText>
          <SemanticText as="h3" className="text-3xl font-bold text-white">
            {footerBrand.name}
          </SemanticText>
          <SemanticText as="p" className="text-sm font-semibold uppercase tracking-[2px] text-secondary">
            {footerBrand.alias}
          </SemanticText>
          <SemanticText as="p" className="text-base leading-7 text-white" style={{ opacity: 0.78 }}>
            {footerBrand.role}
          </SemanticText>
          <SemanticText as="p" className="text-base leading-7 text-white" style={{ opacity: 0.74 }}>
            {footerBrand.body}
          </SemanticText>
        </View>

        <View className="flex-row flex-wrap gap-3">
          {links.map((link, index) => (
            <FooterLinkButton
              key={link.href}
              href={link.href}
              label={link.label}
              onOpenLink={onOpenLink}
              isPrimary={index === 0}
            />
          ))}
        </View>
      </View>
    </SemanticView>
  );
}
