import { Request, Response, NextFunction } from "express";
import { roomsService, RoomsService } from "./rooms.service.js";
import {
  CreateRoomInput,
  UpdateRoomInput,
  UpdateRoomStatusInput,
  QueryRoomsInput,
  CreateRoomTypeInput,
} from "./rooms.schemas.js";

export class RoomsController {
  constructor(private readonly service: RoomsService = roomsService) {}

  listRooms = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as QueryRoomsInput;
      const result = await this.service.listRooms(query);
      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  };

  getRoomBoard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = {
        floor:
          req.query.floor !== undefined ? Number(req.query.floor) : undefined,
        building: req.query.building as string | undefined,
        occupancyStatus: req.query.occupancyStatus as any,
        housekeepingStatus: req.query.housekeepingStatus as any,
        maintenanceStatus: req.query.maintenanceStatus as any,
        roomTypeId: req.query.roomTypeId as string | undefined,
      };

      const boardData = await this.service.getRoomBoard(filter);
      return res.status(200).json({
        success: true,
        data: boardData,
      });
    } catch (err) {
      next(err);
    }
  };

  getRoomById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const room = await this.service.getRoomById(id);
      return res.status(200).json({
        success: true,
        data: room,
      });
    } catch (err) {
      next(err);
    }
  };

  createRoom = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CreateRoomInput;
      const room = await this.service.createRoom(input);
      return res.status(201).json({
        success: true,
        data: room,
        message: "Room created successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  updateRoom = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const input = req.body as UpdateRoomInput;
      const room = await this.service.updateRoom(id, input);
      return res.status(200).json({
        success: true,
        data: room,
        message: "Room updated successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  updateRoomStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const input = req.body as UpdateRoomStatusInput;
      const operator = req.user?.email || req.user?.id || "staff";
      const updatedRoom = await this.service.updateRoomStatus(
        id,
        input,
        operator,
      );

      return res.status(200).json({
        success: true,
        data: updatedRoom,
        message: "Room status updated successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  getRoomHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const history = await this.service.getRoomStatusHistory(
        id,
        limit,
        offset,
      );

      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (err) {
      next(err);
    }
  };

  // Room Types
  listRoomTypes = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const roomTypes = await this.service.listRoomTypes();
      return res.status(200).json({
        success: true,
        data: roomTypes,
      });
    } catch (err) {
      next(err);
    }
  };

  getRoomTypeById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const roomType = await this.service.getRoomTypeById(id);
      return res.status(200).json({
        success: true,
        data: roomType,
      });
    } catch (err) {
      next(err);
    }
  };

  createRoomType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CreateRoomTypeInput;
      const roomType = await this.service.createRoomType(input);
      return res.status(201).json({
        success: true,
        data: roomType,
        message: "Room type created successfully",
      });
    } catch (err) {
      next(err);
    }
  };
}

export const roomsController = new RoomsController();
