import { Router } from "express";
import { roomsController } from "./rooms.controller.js";
import { validate } from "../../middleware/validate.js";
import { optionalAuthenticate } from "../../middleware/authenticate.js";
import {
  createRoomSchema,
  updateRoomSchema,
  updateRoomStatusSchema,
  queryRoomsSchema,
  createRoomTypeSchema,
} from "./rooms.schemas.js";

const router = Router();

// Room Board Overview (Answers "what's happening right now?")
router.get("/rooms/board", optionalAuthenticate, roomsController.getRoomBoard);

// Room Inventory CRUD
router.get(
  "/rooms",
  optionalAuthenticate,
  validate({ query: queryRoomsSchema }),
  roomsController.listRooms,
);

router.post(
  "/rooms",
  optionalAuthenticate,
  validate({ body: createRoomSchema }),
  roomsController.createRoom,
);

router.get("/rooms/:id", optionalAuthenticate, roomsController.getRoomById);

router.patch(
  "/rooms/:id",
  optionalAuthenticate,
  validate({ body: updateRoomSchema }),
  roomsController.updateRoom,
);

// Status Management & Transitions
router.patch(
  "/rooms/:id/status",
  optionalAuthenticate,
  validate({ body: updateRoomStatusSchema }),
  roomsController.updateRoomStatus,
);

router.get(
  "/rooms/:id/history",
  optionalAuthenticate,
  roomsController.getRoomHistory,
);

// Room Types
router.get("/room-types", optionalAuthenticate, roomsController.listRoomTypes);
router.get(
  "/room-types/:id",
  optionalAuthenticate,
  roomsController.getRoomTypeById,
);
router.post(
  "/room-types",
  optionalAuthenticate,
  validate({ body: createRoomTypeSchema }),
  roomsController.createRoomType,
);

export const roomsRouter: Router = router;
