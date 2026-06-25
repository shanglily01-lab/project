/**
 * Syphonix App — Root router.
 */

import { Routes, Route } from 'react-router-dom'
import SyphonixLayout from '@/layouts/SyphonixLayout'
import Feed from '@/pages/Feed'
import Explore from '@/pages/Explore'
import OpenProject from '@/pages/OpenProject'
import Team from '@/pages/Team'
import People from '@/pages/People'
import Projects from '@/pages/Projects'
import Monthly from '@/pages/Monthly'
import Scorecard from '@/pages/Scorecard'
import Leaderboard from '@/pages/Leaderboard'
import ProjectDetail from '@/pages/ProjectDetail'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<SyphonixLayout />}>
        <Route index element={<Feed />} />
        <Route path="explore" element={<Explore />} />
        <Route path="people" element={<People />} />
        <Route path="scorecard/:id" element={<Scorecard />} />
        <Route path="team" element={<Team />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="monthly" element={<Monthly />} />
        <Route path="projects" element={<Projects />} />
        <Route path="project/:name" element={<ProjectDetail />} />
        <Route path="openproject" element={<OpenProject />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
