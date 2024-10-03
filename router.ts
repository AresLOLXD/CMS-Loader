import { Router } from "express";
import AnalizeCSVController from "./controllers/analizeCSV"
const router = Router()
router.use("/CSV", AnalizeCSVController)


export default router