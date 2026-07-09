import { useProfile } from '../hooks/useProfile';
import { AboutMeIntake } from '../components/profile/AboutMeIntake';

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
    </div>
  );
}
