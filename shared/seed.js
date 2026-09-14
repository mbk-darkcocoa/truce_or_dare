'use strict';

function createSeedData() {
  return {
    catalog: [
      {
        id: 'sku-quest-lobby-pack',
        name: 'Quest Launch Lobby Pack',
        category: 'Storefront',
        platform: 'Meta Quest',
        price: 49,
        featured: true,
        availability: 'Pilot ready',
        description: 'Starter asset bundle for a moderated VR lobby with live launch support.'
      },
      {
        id: 'sku-webxr-ops-console',
        name: 'WebXR Operations Console',
        category: 'Admin',
        platform: 'Browser + WebXR',
        price: 79,
        featured: true,
        availability: 'Preview',
        description: 'Cross-device control surface for product, moderation, and support oversight.'
      },
      {
        id: 'sku-support-cloud-seat',
        name: 'Support Cloud Seat',
        category: 'Support',
        platform: 'Cloud',
        price: 29,
        featured: false,
        availability: 'Available',
        description: 'Ticketing, escalation, and audit support workflows for customer operations.'
      }
    ],
    lobby: {
      forums: [
        {
          slug: 'builders-hub',
          title: 'Builders Hub',
          audience: 'Developers',
          summary: 'Discuss storefront launches, SDK readiness, and device rollout planning.',
          threads: 24
        },
        {
          slug: 'operators-lounge',
          title: 'Operators Lounge',
          audience: 'Support + Admin',
          summary: 'Coordinate service health, runbooks, and launch staffing.',
          threads: 11
        },
        {
          slug: 'creator-market',
          title: 'Creator Market',
          audience: 'Vendors',
          summary: 'Share listings, merchandising ideas, and promotion plans.',
          threads: 17
        }
      ],
      moderationQueue: [
        {
          id: 'mod-1001',
          forum: 'builders-hub',
          reason: 'Needs policy review before promotion',
          status: 'pending'
        },
        {
          id: 'mod-1002',
          forum: 'creator-market',
          reason: 'Missing platform compatibility notes',
          status: 'pending'
        }
      ]
    },
    support: {
      knowledgeBase: [
        {
          id: 'kb-quest-access',
          title: 'Meta Quest sign-in fallback',
          summary: 'Steps to continue in browser when headset login or linking is unavailable.'
        },
        {
          id: 'kb-order-sync',
          title: 'Catalog and order sync checklist',
          summary: 'How operators confirm inventory, pricing, and release readiness.'
        },
        {
          id: 'kb-escalation',
          title: 'Escalation path for launch-day incidents',
          summary: 'Roles, severities, and handoff expectations for support coverage.'
        }
      ],
      tickets: []
    },
    workbook: [
      {
        id: 'scope',
        title: 'MVP scope',
        outcome: 'Define the first shippable surface and boundaries.',
        docPath: '/workbook/01-mvp-scope.md'
      },
      {
        id: 'architecture',
        title: 'Architecture',
        outcome: 'Map core domains and client responsibilities.',
        docPath: '/workbook/02-architecture.md'
      },
      {
        id: 'operations',
        title: 'Support and deployment',
        outcome: 'Document service operations, cloud readiness, and controls.',
        docPath: '/workbook/03-operations.md'
      }
    ]
  };
}

module.exports = {
  createSeedData
};
