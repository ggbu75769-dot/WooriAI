export const elevation = {
  flat: { elevation: 0, shadowOpacity: 0 },
  card: {
    elevation: 1,
    shadowColor: "#211E1C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3
  },
  overlay: {
    elevation: 8,
    shadowColor: "#211E1C",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32
  }
} as const;
