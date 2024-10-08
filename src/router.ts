import { Router } from "express";
import AddParticipationController from "./controllers/addParticipation";
import AnalizeCSVController from "./controllers/CSVRequests";
import RegisterUsersController from "./controllers/registerUsers";
import ViewsController from "./controllers/views";
const router = Router()


router.use("/CSV", AnalizeCSVController)
router.use("/registerUsers", RegisterUsersController)
router.use("/addParticipation", AddParticipationController)
router.use("/", ViewsController)

export default router