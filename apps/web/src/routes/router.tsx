import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../components/RequireAuth";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { ContactGatePage } from "../pages/ContactGatePage";
import { PlanStatusPage } from "../pages/PlanStatusPage";
import { IntakeMethodPage } from "../pages/IntakeMethodPage";
import { UploadPage } from "../pages/UploadPage";
import { ExtractionReviewPage } from "../pages/ExtractionReviewPage";
import { WizardLayout } from "../pages/wizard/WizardLayout";
import { StepIdentity } from "../pages/wizard/StepIdentity";
import { StepContributions } from "../pages/wizard/StepContributions";
import { StepEligibility } from "../pages/wizard/StepEligibility";
import { StepVesting } from "../pages/wizard/StepVesting";
import { StepAdministration } from "../pages/wizard/StepAdministration";
import { StepTrusteesFunds } from "../pages/wizard/StepTrusteesFunds";
import { Review } from "../pages/wizard/Review";
import { SuccessPage } from "../pages/SuccessPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/onboarding/new" element={<ContactGatePage />} />
        <Route path="/onboarding/:planId/plan-status" element={<PlanStatusPage />} />
        <Route path="/onboarding/:planId/intake" element={<IntakeMethodPage />} />
        <Route path="/onboarding/:planId/upload" element={<UploadPage />} />
        {/* Sits between upload and step 1 so the extraction can be validated
            before it's accepted. documentId is carried for traceability. */}
        <Route path="/onboarding/:planId/extraction/:documentId" element={<ExtractionReviewPage />} />

        <Route path="/onboarding/:planId" element={<WizardLayout />}>
          <Route path="step/identity" element={<StepIdentity />} />
          <Route path="step/contributions" element={<StepContributions />} />
          <Route path="step/eligibility" element={<StepEligibility />} />
          <Route path="step/vesting" element={<StepVesting />} />
          <Route path="step/administration" element={<StepAdministration />} />
          <Route path="step/trustees_funds" element={<StepTrusteesFunds />} />
          <Route path="review" element={<Review />} />
        </Route>

        <Route path="/onboarding/:planId/success" element={<SuccessPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
