import { Router } from "express";
import AddParticipationController from "./controllers/addParticipation";
import AnalyzeCSVController from "./controllers/analyzeCSV";
import AuthController from "./controllers/auth";
import JobsController from "./controllers/jobs";
import RegisterUsersController from "./controllers/registerUsers";
import ViewsController from "./controllers/views";
import { generateToken } from "./csrf";
import { requireAuth } from "./middleware/requireAuth";

const router = Router()

router.use("/login", AuthController)

router.get("/api/csrf-token", requireAuth, (req, res) => {
  const token = generateToken(req, res)
  res.json({ token })
})

router.use(requireAuth)

router.use("/analyzeCSV", AnalyzeCSVController)
router.use("/registerUsers", RegisterUsersController)
router.use("/addParticipation", AddParticipationController)
router.use("/jobs", JobsController)
router.use("/", ViewsController)

export default router
