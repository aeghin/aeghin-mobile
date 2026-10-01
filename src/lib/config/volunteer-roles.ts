import type { VolunteerRole } from "@/types/event";
import type { Team } from "@/types/team-notifications";

/** One volunteer role, as `GET /api/mobile/v1/roles` describes it. */
export type CatalogRole = {
  role: VolunteerRole;
  label: string;
  emoji: string;
  team: Team;
  /** Can be put on a song in a setlist, and keeps a key journal. */
  sings: boolean;
};

export type CatalogTeam = {
  team: Team;
  label: string;
};

/** Every role and team, in roster order. Mirrors the NHC route's wire type. */
export type RoleCatalog = {
  roles: CatalogRole[];
  teams: CatalogTeam[];
};

/**
 * The roles as this build shipped: what the app shows until the server's list
 * arrives, and all it has against a server too old to send one. The server's
 * list is the real one — a role or team added there shows up here without a
 * release.
 *
 * Emoji, character for character with the web's `lib/config/roles.ts`. They
 * are the one place in this app that is not a lucide glyph: colour is what
 * tells the roles apart at chip size. Every glyph is Emoji 3.0 or older, which
 * Android 7.0 (`minSdkVersion` 24) can draw.
 */
export const BUILT_IN_CATALOG: RoleCatalog = {
  roles: [
    { role: "PIANIST", label: "Pianist", emoji: "🎹", team: "BAND", sings: false },
    { role: "AUX_KEYS", label: "Aux Keys", emoji: "🎹", team: "BAND", sings: false },
    { role: "BASSIST", label: "Bassist", emoji: "🎸", team: "BAND", sings: false },
    { role: "GUITARIST", label: "Guitarist", emoji: "🎸", team: "BAND", sings: false },
    { role: "DRUMMER", label: "Drummer", emoji: "🥁", team: "BAND", sings: false },
    { role: "LEAD_VOCALIST", label: "Lead Vocalist", emoji: "🎤", team: "VOCALS", sings: true },
    { role: "BGVS", label: "BGVs", emoji: "🎤", team: "VOCALS", sings: true },
    { role: "SOUND_TECH", label: "Sound Tech", emoji: "🎚️", team: "PRODUCTION", sings: false },
    { role: "STREAM_TECH", label: "Stream Tech", emoji: "📹", team: "PRODUCTION", sings: false },
    { role: "PROJECTION_TECH", label: "Projection", emoji: "📽️", team: "PRODUCTION", sings: false },
    { role: "USHER", label: "Usher", emoji: "🚪", team: "HOSPITALITY", sings: false },
    { role: "GREETER", label: "Greeter", emoji: "👋", team: "HOSPITALITY", sings: false },
  ],
  teams: [
    { team: "BAND", label: "Band" },
    { team: "VOCALS", label: "Vocals" },
    { team: "PRODUCTION", label: "Production" },
    { team: "HOSPITALITY", label: "Hospitality" },
  ],
};

/** Where a role the catalog doesn't know is grouped. */
const OTHER_TEAM: Team = "OTHER";

/** `"CAMERA_OP"` -> `"Camera Op"`, for a key the catalog doesn't know. */
const humanize = (key: string) =>
  key
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

/** Everything a screen asks about roles. */
export type Roles = {
  /** Every role, in roster order. */
  order: VolunteerRole[];
  /** Every team, in roster order. */
  teams: Team[];
  /** One role's label, emoji and team. A role the catalog doesn't know gets a readable stand-in. */
  get: (role: VolunteerRole) => CatalogRole;
  teamLabel: (team: Team) => string;
  teamOf: (role: VolunteerRole) => Team;
  /** These roles in roster order. Any the catalog doesn't know go last rather than vanishing. */
  inOrder: (roles: VolunteerRole[]) => VolunteerRole[];
  /** The teams a set of roles falls into, in roster order. */
  teamsOf: (roles: VolunteerRole[]) => Team[];
  /** One team's roles for a sentence: "Sound Tech, Stream Tech". */
  teamRolesLabel: (team: Team) => string;
  /** Whether any of these roles sings: the gate for My Keys and song assignment. */
  sings: (roles: VolunteerRole[] | undefined) => boolean;
};

/** The catalog, with every question a screen asks of it. */
export function buildRoles(catalog: RoleCatalog): Roles {
  const byRole = new Map(catalog.roles.map((entry) => [entry.role, entry]));
  const labels = new Map(catalog.teams.map((entry) => [entry.team, entry.label]));
  const order = catalog.roles.map((entry) => entry.role);
  const teams = catalog.teams.map((entry) => entry.team);

  const get = (role: VolunteerRole): CatalogRole =>
    byRole.get(role) ?? {
      role,
      label: humanize(role),
      emoji: "👤",
      team: OTHER_TEAM,
      sings: false,
    };

  const teamOf = (role: VolunteerRole) => get(role).team;

  const inOrder = (roles: VolunteerRole[]) => [
    ...order.filter((role) => roles.includes(role)),
    ...[...new Set(roles)].filter((role) => !byRole.has(role)),
  ];

  const teamsOf = (roles: VolunteerRole[]) => {
    const present = new Set(roles.map(teamOf));

    return [
      ...teams.filter((team) => present.has(team)),
      ...[...present].filter((team) => !labels.has(team)),
    ];
  };

  const ofTeam = (team: Team) => order.filter((role) => teamOf(role) === team);

  return {
    order,
    teams,
    get,
    teamLabel: (team) => labels.get(team) ?? humanize(team),
    teamOf,
    inOrder,
    teamsOf,
    teamRolesLabel: (team) =>
      ofTeam(team)
        .map((role) => get(role).label)
        .join(", "),
    sings: (roles) => roles?.some((role) => get(role).sings) ?? false,
  };
}
