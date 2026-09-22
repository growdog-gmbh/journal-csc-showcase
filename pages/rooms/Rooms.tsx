import { ROOMS } from "./placeholderRoom.js";
import { RoomDashboard } from "./RoomDashboard.js";

// /rooms without a room picked: the first room opens, the list on the
// left takes it from there (each pick is its own URL, see RoomDetail).
export function RoomsPage() {
  const first = ROOMS[0];
  if (first === undefined) throw new Error("No rooms to show.");
  return <RoomDashboard key={first.id} roomId={first.id} />;
}
