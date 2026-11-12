

# Prairie Dogs — Cancer-Ecology Simulators

**Live demo (G-function):** https://cancer-ecology-center.github.io/tumor-ecology-models/
**Live demo (PDE spread):** https://cancer-ecology-center.github.io/tumor-ecology-models/#/PDE

Two interactive simulators that use a prairie dog town as a mesoscopic ecological analog for a tumor:

1. A **PDE spread simulator** — 2-D logistic growth with niche construction, an immune/predator response, and diffusion, integrated on a grid. Scenarios correspond to the four "archetypes" described in the main text. Viewers allow for visualizing the raw density field (`N`) or 
2. A **G-function simulator** (Vincent & Brown) — non-spatial adaptive dynamics over a single strategy axis. 

# Figure reproducibility 

Code to reproduce the figures is given in the `coupled_pde/figures.ipynb` notebook. To generate them
1. Install `uv` for package management and run `uv sync` at the root of this repo. Expects Python 3.15 or higher.
2. In the figures.ipynb notebook, select the tumor_ecology_models kernel when running the first cell
3. The notebook is separated into three sections: (1) the uncoupled PDE, (2) the coupled (hybrid) PDE, and (3) checks that a Cartesian simulation with homogeneous and heterogeneous initial conditions is numerically stable and reproduces the key results from the paper.
