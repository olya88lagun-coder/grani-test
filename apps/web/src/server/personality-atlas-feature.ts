// Release switch: no new table is queried while the feature is disabled.
export const personalityAtlasEnabled = () => process.env.PERSONALITY_ATLAS_V2 === "1";
