# Reference for the port's Rack and Pinion generator (src/lib/generators/rackgear.ts).
#
# boxes.py has no rack generator, but its gears engine draws racks
# (`draw_rack`). This drives that engine with the same calls the port makes,
# so the golden cases check the port against boxes.py's own geometry. It is
# not part of boxes.py; keep it in step with rackgear.ts.
#
# GPL v3+, as boxes.py.

from boxes import Boxes

HOLE_MARGIN = 1


class RackGear(Boxes):
    """Rack and pinion"""

    def __init__(self) -> None:
        Boxes.__init__(self)
        add = self.argparser.add_argument
        add("--rack_teeth", action="store", type=int, default=20)
        add("--pinion_teeth", action="store", type=int, default=16)
        add("--modulus", action="store", type=float, default=2)
        add("--shaft", action="store", type=float, default=6)
        add("--dpercentage", action="store", type=float, default=75)
        add("--base_height", action="store", type=float, default=8)
        add("--base_tab", action="store", type=float, default=14)
        # Not `--hole`: that would set self.hole over the hole() method.
        add("--screw_hole", action="store", type=float, default=3)
        add("--pressure_angle", action="store", type=float, default=20)
        add("--profile_shift", action="store", type=float, default=20)

    def render(self):
        spec = dict(dimension=self.modulus, angle=self.pressure_angle,
                    profile_shift=self.profile_shift)
        d = self.screw_hole
        holes_fit = d + 2 * HOLE_MARGIN <= min(self.base_tab, self.base_height)

        # The rack's width, as rackSize() in the port. boxes.py's sizes()
        # fails for a rack, so this is draw_rack's own expression.
        width = self.rack_teeth * 3.141592653589793 * self.modulus + 2 * self.base_tab

        def holes():
            self.hole(self.base_tab / 2, self.base_height / 2, d / 2)
            self.hole(width - self.base_tab / 2, self.base_height / 2, d / 2)

        self.gears(draw_rack=True, rack_teeth_length=self.rack_teeth,
                   rack_base_height=self.base_height, rack_base_tab=self.base_tab,
                   callback=holes if d and holes_fit else None,
                   move="up", **spec)

        if self.pinion_teeth:
            self.gears(teeth=self.pinion_teeth,
                       callback=lambda: self.dHole(0, 0, d=self.shaft,
                                                   rel_w=self.dpercentage / 100.),
                       move="up", **spec)
