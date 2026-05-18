import { Router } from "express";
import AddParticipationController from "./controllers/addParticipation.js";
import AnalyzeCSVController from "./controllers/analyzeCSV.js";
import AuthController from "./controllers/auth.js";
import JobsController from "./controllers/jobs.js";
import RegisterUsersController from "./controllers/registerUsers.js";
import { generateToken } from "./csrf.js";
import { requireAuth } from "./middleware/requireAuth.js";

const router = Router()

router.use("/login", AuthController)

router.get("/api/csrf-token", (req, res) => {
  const token = generateToken(req, res)
  res.json({ token })
})

router.get("/api/me", (req, res) => {
  res.json({ authenticated: req.session.authenticated === true })
})

router.use(requireAuth)

router.use("/analyzeCSV", AnalyzeCSVController)
router.use("/registerUsers", RegisterUsersController)
router.use("/addParticipation", AddParticipationController)
router.use("/jobs", JobsController)

export default router
