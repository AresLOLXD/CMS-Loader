import { Router } from "express";
import AddParticipationController from "./controllers/addParticipation";
import AnalyzeCSVController from "./controllers/analyzeCSV";
import RegisterUsersController from "./controllers/registerUsers";
import ViewsController from "./controllers/views";
const router = Router()


router.use("/analyzeCSV", AnalyzeCSVController)
router.use("/registerUsers", RegisterUsersController)
router.use("/addParticipation", AddParticipationController)
router.use("/", ViewsController)

export default router