import { useProfile } from '../hooks/useProfile';
import { AboutMeIntake } from '../components/profile/AboutMeIntake';
import { ValuesSection } from '../components/profile/ValuesSection';
import { ConcernsSection } from '../components/profile/ConcernsSection';
import { EducationTopicsSection } from '../components/profile/EducationTopicsSection';
import { DeleteAccountSection } from '../components/profile/DeleteAccountSection';

export function ProfilePage() {
  const { profile, isLoading, updateAboutMe, isSaving } = useProfile();

  return (
    <div className="profile-page">
      <h1>About me</h1>
      {isLoading ? (
        <p>Loading your profile...</p>
      ) : (
        <AboutMeIntake aboutMe={profile?.aboutMe} onSave={updateAboutMe} isSaving={isSaving} />
      )}
      <ValuesSection />
      <ConcernsSection />
      <EducationTopicsSection />
      <DeleteAccountSection />
    </div>
  );
}
