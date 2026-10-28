import unittest
from main import estimate_cycles


class MovementCyclesTest(unittest.TestCase):
    def samples(self, angles):
        return [{'left_elbow': value, 'right_elbow': value} for value in angles]

    def test_complete_cycles_and_insufficient_evidence(self):
        angles = [160]*3 + [90]*3 + [160]*3 + [90]*3 + [160]*3
        self.assertEqual(estimate_cycles(self.samples(angles), 'chest_press')['estimatedReps'], 2)
        self.assertIsNone(estimate_cycles(self.samples(angles), None))
        self.assertIsNone(estimate_cycles(self.samples([120]*15), 'chest_press'))
        self.assertIsNone(estimate_cycles(self.samples(angles)[:-1] + [{}], 'chest_press'))
        self.assertIsNone(estimate_cycles(self.samples(angles), 'squat'))


if __name__ == '__main__':
    unittest.main()
