'use client';

import { useEffect } from 'react';

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);
const configuredLinks = new WeakMap<
  HTMLAnchorElement,
  { rel: string | null; target: string | null }
>();

function configureExternalLink(link: HTMLAnchorElement) {
  const isExternal =
    EXTERNAL_PROTOCOLS.has(link.protocol) &&
    link.origin !== window.location.origin;

  if (!isExternal) {
    const originalAttributes = configuredLinks.get(link);

    if (originalAttributes) {
      if (originalAttributes.target === null) {
        link.removeAttribute('target');
      } else {
        link.setAttribute('target', originalAttributes.target);
      }

      if (originalAttributes.rel === null) {
        link.removeAttribute('rel');
      } else {
        link.setAttribute('rel', originalAttributes.rel);
      }

      configuredLinks.delete(link);
    }

    return;
  }

  if (!configuredLinks.has(link)) {
    configuredLinks.set(link, {
      rel: link.getAttribute('rel'),
      target: link.getAttribute('target'),
    });
  }

  link.target = '_blank';

  const relationships = new Set(link.rel.split(/\s+/).filter(Boolean));
  relationships.add('noopener');
  relationships.add('noreferrer');
  link.rel = Array.from(relationships).join(' ');
}

function configureLinks(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(configureExternalLink);
}

export default function ExternalLinkBehavior() {
  useEffect(() => {
    configureLinks(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.target instanceof HTMLAnchorElement
        ) {
          configureExternalLink(mutation.target);
          return;
        }

        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLAnchorElement) {
            configureExternalLink(node);
          }

          if (node instanceof Element) {
            configureLinks(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['href'],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
